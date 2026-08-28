import { erc20Abi, type Address, type PublicClient } from 'viem';
import type { UserOperationReceipt } from 'viem/account-abstraction';

import { useUser } from '@/composables/useUser';
import { MIN_FEE_BALANCE_WEI_DEFAULT } from '@/config/aa';
import { TokenEnum } from '@/model/NetworkEnum';
import {
  assertErc20PaymasterTokenSupported,
  InsufficientFeeTokenBalanceError,
  prepareErc20PaymasterQuote,
  sendPreparedErc20UserOperation,
} from './paymasters/erc20';
import { ensureReownEoaAccount, getReownEip155Address } from '@/config/appkit';
import {
  getCurrentAccount,
  getPublicClient,
  getWalletClient,
} from '../provider';
import {
  getAaOwnerKind,
  PASSKEY_CONNECTOR_ID,
  REOWN_AUTH_CONNECTOR_ID,
} from './session';
import {
  getAaAccountForRuntime,
  getAaContextForRuntime,
  isAaAvailable,
} from './aaContext';
import type { AaCall, AaContext, AaOwnerKind, AaRuntime } from './types';

export { resetAaAccountCache } from './aaContext';

const resolveActiveRuntime = async (
  ownerKind: AaOwnerKind,
  network: AaRuntime['network'],
): Promise<AaRuntime> => {
  if (ownerKind === 'reown') {
    // Ensure Reown returns EOA, not smart account, for Kernel ownership
    await ensureReownEoaAccount();

    const walletClient = await getWalletClient();
    if (!walletClient?.account) {
      throw new Error('Reown EOA signer not available');
    }

    // ensureReownEoaAccount only proves Reown's own state. wagmi may not have
    // propagated the switch yet, and deriving the Kernel account from the
    // smart account would cache an account owned by the wrong key for the
    // rest of the session.
    const reownAddress = getReownEip155Address();
    if (
      reownAddress &&
      walletClient.account.address.toLowerCase() !== reownAddress.toLowerCase()
    ) {
      throw new Error('Reown EOA signer has not propagated to wagmi yet');
    }

    return {
      connectorId: REOWN_AUTH_CONNECTOR_ID,
      publicClient: getPublicClient(),
      walletClient,
      network,
    };
  }

  return {
    connectorId: PASSKEY_CONNECTOR_ID,
    publicClient: getPublicClient(),
    network,
  };
};

const resolveActiveAaRuntime = async (): Promise<AaRuntime | null> => {
  const connection = getCurrentAccount();
  const ownerKind = getAaOwnerKind(connection.connector?.id);
  if (!ownerKind) return null;

  const network = useUser().network.value;
  if (!isAaAvailable(network)) return null;

  return resolveActiveRuntime(ownerKind, network);
};

/** Resolve the active app connection into the unified Kernel rail. */
export const getActiveAaContext = async (): Promise<AaContext | null> => {
  const runtime = await resolveActiveAaRuntime();
  if (!runtime) return null;

  return getAaContextForRuntime(runtime);
};

/** The connector address is the fallback for connectors without an AA rail. */
export const getEffectiveWalletAddress = async (
  fallback: Address,
): Promise<Address> => {
  const runtime = await resolveActiveAaRuntime();
  if (!runtime) return fallback;
  const account = await getAaAccountForRuntime(runtime);
  return account?.address ?? fallback;
};

const sendSponsored = async (
  aa: AaContext,
  calls: readonly AaCall[],
): Promise<UserOperationReceipt> => {
  const hash = await aa.sponsoredClient.sendUserOperation({
    calls: [...calls],
  });
  return aa.sponsoredClient.waitForUserOperationReceipt({ hash });
};

/**
 * Send one or more calls as a single UserOperation. An account holding enough
 * of the fee token pays through Pimlico's ERC-20 paymaster; an account without
 * it uses the sponsorship policy, so a buyer with an empty balance can still
 * be released and a seller can still make their first deposit.
 *
 * `feeToken` is the token the operation itself moves, checked against the
 * configured paymaster token before the paid path is used.
 *
 * `feeTokenOutflow` is the amount of fee token this batch will move out of
 * the smart account once it runs. It cannot be inferred from the batch
 * itself: the seller deposit, for example, transfers the fee token via a
 * `transferFrom` executed inside P2Pix by `deposit`, not as a top-level
 * call. The caller knows what its batch will actually move.
 */
export const sendAaOperation = async (
  aa: AaContext,
  calls: readonly AaCall[],
  feeToken: Address,
  feeTokenOutflow: bigint = 0n,
): Promise<UserOperationReceipt> => {
  const publicClient = aa.account.client as PublicClient;

  // Pimlico always charges in the configured paymaster token, which is not
  // necessarily the token being moved, so the fee gate must read that balance.
  const feeTokenBalance = await publicClient.readContract({
    address: aa.network.tokens[TokenEnum.BRZ].address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [aa.account.address],
  });

  // Subtract the caller's reported fee-token outflow so the gate and the
  // paymaster quote both see the balance that will still be in the account
  // after the batch runs. Without this, a seller depositing their whole BRZ
  // balance passes the gate, then the postOp charge finds nothing left and
  // the UserOp reverts with AA33 instead of falling back to sponsorship.
  const effectiveFeeTokenBalance = feeTokenBalance - feeTokenOutflow;

  const minFeeBalance =
    aa.network.aa?.minFeeBalance ?? MIN_FEE_BALANCE_WEI_DEFAULT;
  if (effectiveFeeTokenBalance < minFeeBalance) {
    // Sponsored path stays free of paymaster round-trips: an account with no
    // fee token is exactly the one that cannot afford an extra failure mode.
    return sendSponsored(aa, calls);
  }

  // The paymaster may not support the app token at all (wrong chain,
  // unconfigured). Sponsorship is still open, and on a release the PIX has
  // already been paid, so we MUST fall back rather than rethrow. The error is
  // logged because the silent downgrade hides two distinct failure modes: a
  // transient Pimlico 5xx on getTokenQuotes, and a deploy-time token
  // misconfiguration that breaks the paid rail while sponsorship quietly
  // absorbs every call and drains the budget.
  try {
    await assertErc20PaymasterTokenSupported(aa, feeToken);
  } catch (cause) {
    console.error(
      'ERC-20 paymaster assertion failed; skipping paid rail and falling back to sponsorship.',
      cause,
    );
    return sendSponsored(aa, calls);
  }

  let quote;
  try {
    quote = await prepareErc20PaymasterQuote(
      aa,
      calls,
      effectiveFeeTokenBalance,
    );
  } catch (cause) {
    if (!(cause instanceof InsufficientFeeTokenBalanceError)) throw cause;
    // minFeeBalance is a floor, not the real cost of this operation, so a
    // balance above it can still fall short of the quote. Sponsorship is
    // still open, and on a release the PIX has already been paid.
    return sendSponsored(aa, calls);
  }

  const hash = await sendPreparedErc20UserOperation(aa, quote);
  return aa.erc20Client.waitForUserOperationReceipt({ hash });
};

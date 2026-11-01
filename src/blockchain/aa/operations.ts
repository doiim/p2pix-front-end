import {
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import type { UserOperationReceipt } from 'viem/account-abstraction';

import { useUser } from '@/composables/useUser';
import {
  InsufficientFeeTokenBalanceError,
  prepareErc20PaymasterQuote,
  sendPreparedErc20UserOperation,
} from './paymasters/erc20';
import {
  getCurrentAccount,
  getPublicClient,
  getWalletClient,
} from '../provider';
import {
  getAaAccountForRuntime,
  getAaContextForRuntime,
  getAaOwnerKind,
  isAaAvailable,
} from './aaContext';
import type { AaCall, AaContext, AaRuntime } from './types';
import type { NetworkConfig } from '@/model/NetworkEnum';

export { resetAaAccountCache } from './aaContext';

/** Fee token argument for `sendAaOperation`: unset on a sponsorship-only chain, where it is never read. */
export const feeTokenAddress = (aa: AaContext): Address => {
  const feeToken = aa.network.aa?.feeToken;
  return feeToken ? aa.network.tokens[feeToken].address : zeroAddress;
};

/** The Kernel rail of `connectorId` on `network`, from the given values only. */
const resolveAaRuntime = async (
  network: NetworkConfig,
  connectorId: string | undefined,
): Promise<AaRuntime | null> => {
  const ownerKind = getAaOwnerKind(connectorId);
  if (!ownerKind || !isAaAvailable(network)) return null;

  const walletClient = ownerKind === 'social' ? await getWalletClient() : null;
  if (ownerKind === 'social' && !walletClient?.account) {
    throw new Error('Social login signer not available');
  }
  return {
    ownerKind,
    publicClient: getPublicClient(network.id),
    walletClient,
    network,
  };
};

/** Resolve the active app connection into the unified Kernel rail. */
export const getActiveAaContext = async (): Promise<AaContext | null> => {
  // Sending follows the live selection; `assertSender` refuses it if that moved.
  const runtime = await resolveAaRuntime(
    useUser().network.value,
    getCurrentAccount().connector?.id,
  );
  if (!runtime) return null;

  return getAaContextForRuntime(runtime);
};

/**
 * The address the app acts as for `connectorId` on `network`: its Kernel
 * account, or `fallback` (the connector's own address) without an AA rail.
 * Reads only its arguments, so a query keyed on them caches the right value.
 */
export const getEffectiveWalletAddress = async (
  fallback: Address,
  network: NetworkConfig,
  connectorId: string | undefined,
): Promise<Address> => {
  const runtime = await resolveAaRuntime(network, connectorId);
  if (!runtime) return fallback;
  const account = await getAaAccountForRuntime(runtime);
  return account?.address ?? fallback;
};

const sendSponsored = async (
  aa: AaContext,
  calls: readonly AaCall[],
  onSent?: (hash: Hex) => void,
): Promise<UserOperationReceipt> => {
  const hash = await aa.sponsoredClient.sendUserOperation({
    calls: [...calls],
  });
  onSent?.(hash);
  return aa.sponsoredClient.waitForUserOperationReceipt({ hash });
};

/**
 * Fee token a batch moves out of the smart account from inside a contract
 * call or a transfer, which the paymaster's balance check cannot see: P2Pix's
 * `deposit` pulls the seller token with `transferFrom`, and a send moves it
 * directly. One pair; it only matters when `token` is the fee token.
 */
export type AaOutflow = { token: Address; amount: bigint };

/**
 * Send one or more calls as a single UserOperation. With `AaConfig.feeToken`
 * unset (every network today) P2Pix sponsors it, with no quote attempt. With
 * it set, Pimlico's ERC-20 paymaster is quoted against the fee-token balance
 * left after `outflow`; when that falls short or the quote fails, the
 * sponsorship policy pays instead. Only the quote falls back: a failed send
 * may still land, and resending it sponsored could run the calls twice.
 */
export const sendAaOperation = async (
  aa: AaContext,
  calls: readonly AaCall[],
  outflow?: AaOutflow,
  /** Called once the operation is accepted by the bundler, before its receipt. */
  onSent?: (hash: Hex) => void,
): Promise<UserOperationReceipt> => {
  const feeToken = aa.network.aa?.feeToken;
  if (!feeToken || !aa.erc20Client) return sendSponsored(aa, calls, onSent);

  const feeTokenAddress = aa.network.tokens[feeToken].address;
  const movedOut =
    outflow?.token.toLowerCase() === feeTokenAddress.toLowerCase()
      ? outflow.amount
      : 0n;

  let quote;
  try {
    const balance = await (aa.account.client as PublicClient).readContract({
      address: feeTokenAddress,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [aa.account.address],
    });
    quote = await prepareErc20PaymasterQuote(aa, calls, balance - movedOut);
  } catch (cause) {
    // Short balance is the expected case; anything else (unsupported token,
    // Pimlico outage) is logged so the silent downgrade stays visible.
    if (!(cause instanceof InsufficientFeeTokenBalanceError)) {
      console.error('ERC-20 paymaster quote failed; sponsoring.', cause);
    }
    return sendSponsored(aa, calls, onSent);
  }

  const hash = await sendPreparedErc20UserOperation(aa, quote);
  onSent?.(hash);
  return aa.erc20Client.waitForUserOperationReceipt({ hash });
};

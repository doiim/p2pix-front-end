import { computed, ref } from 'vue';
import {
  getTokenBalances,
  type TokenBalance,
} from '@doiim/passkeys/smart-account';
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';

import { isAaAvailable } from '@/blockchain/aa/aaContext';
import { getActiveAaContext } from '@/blockchain/aa/operations';
import { getAaOwnerKind, readPasskeySession } from '@/blockchain/aa/session';
import type { AaCall } from '@/blockchain/aa/types';
import {
  prepareErc20PaymasterQuote,
  sendPreparedErc20UserOperation,
} from '@/blockchain/aa/paymasters/erc20';
import { getCurrentAccount, getPublicClient } from '@/blockchain/provider';
import { useUser } from '@/composables/useUser';
import { TokenEnum } from '@/model/NetworkEnum';

type SweepResult = {
  userOpHash: Hex;
  swept: {
    eth: bigint;
    tokens: TokenBalance[];
  };
};

const FEE_HEADROOM_BPS = 2_000n;
const BPS_DENOMINATOR = 10_000n;

const tokenTransfer = (
  token: Address,
  recipient: Address,
  amount: bigint,
): AaCall => ({
  to: token,
  value: 0n,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, amount],
  }),
});

export function usePasskeyAccount() {
  const user = useUser();
  const busy = ref(false);
  const error = ref<string | null>(null);
  const lastUserOpHash = ref<string | null>(null);
  const balances = ref<TokenBalance[]>([]);
  const ethBalance = ref<bigint>(0n);
  const smartAccountAddress = ref<Address | null>(
    user.walletAddress.value ??
      readPasskeySession()?.smartAccountAddress ??
      null,
  );

  const isReady = computed(() => {
    if (!isAaAvailable(user.network.value)) return false;
    // The wallet address is part of the readiness check on purpose: a null
    // address means the AA smart account never resolved, so the account is
    // not actually usable even when an owner kind exists. Including it here
    // also keeps the reactive dependency live — the read determines the
    // result, so no minifier can legally drop it.
    return (
      Boolean(user.walletAddress.value) &&
      Boolean(getAaOwnerKind(getCurrentAccount().connector?.id))
    );
  });

  const getAaClient = async () => {
    const context = await getActiveAaContext();
    if (!context) throw new Error('AA context not available');
    smartAccountAddress.value = context.account.address;
    return context;
  };

  const readBalances = async () => {
    const context = await getAaClient();
    const paymasterToken = context.network.tokens[TokenEnum.BRZ].address;
    const result = await getTokenBalances(
      getPublicClient(),
      context.account.address,
      [paymasterToken],
    );
    return { context, paymasterToken, result };
  };

  const refreshBalances = async (): Promise<void> => {
    try {
      const { result } = await readBalances();
      ethBalance.value = result.eth;
      balances.value = result.tokens;
    } catch (cause) {
      error.value =
        cause instanceof Error ? cause.message : 'Failed to fetch balances';
    }
  };

  const sweep = async (recipient: Address): Promise<SweepResult | null> => {
    busy.value = true;
    error.value = null;
    lastUserOpHash.value = null;
    try {
      const { context, paymasterToken, result } = await readBalances();
      const tokenBalance = result.tokens[0];
      if (!tokenBalance || tokenBalance.balance === 0n) {
        throw new Error('BRZ balance is required to pay for sweep gas');
      }

      const nativeCall: AaCall[] =
        result.eth > 0n
          ? [{ to: recipient, value: result.eth, data: '0x' }]
          : [];

      // Probe with a non-zero amount so the transfer has the same gas shape as
      // the real call: only zero-vs-non-zero changes the recipient's SSTORE
      // cost, not the amount itself. It cannot be the whole balance, though —
      // the probe is simulated, and an account that just sent everything has
      // nothing left to pay the paymaster's postOp charge with. Sending most
      // of it keeps the shape and leaves the simulation solvent. The exact
      // operation is prepared again once the real reserve is known.
      const probeAmount = (tokenBalance.balance * 9n) / 10n;
      const probe = await prepareErc20PaymasterQuote(context, [
        tokenTransfer(paymasterToken, recipient, probeAmount),
        ...nativeCall,
      ]);
      const feeReserve =
        probe.costInToken +
        (probe.costInToken * FEE_HEADROOM_BPS) / BPS_DENOMINATOR;
      if (tokenBalance.balance <= feeReserve) {
        throw new Error('BRZ balance does not cover sweep gas');
      }

      const transferAmount = tokenBalance.balance - feeReserve;
      const quote = await prepareErc20PaymasterQuote(context, [
        tokenTransfer(paymasterToken, recipient, transferAmount),
        ...nativeCall,
      ]);
      if (quote.costInToken > feeReserve) {
        throw new Error('Sweep gas changed; refresh balances and try again');
      }

      const userOpHash = await sendPreparedErc20UserOperation(context, quote);
      const receipt = await context.erc20Client.waitForUserOperationReceipt({
        hash: userOpHash,
      });
      if (!receipt.success) throw new Error(`AA sweep failed: ${userOpHash}`);

      lastUserOpHash.value = userOpHash;
      return {
        userOpHash,
        swept: {
          eth: result.eth,
          tokens: [{ ...tokenBalance, balance: transferAmount }],
        },
      };
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Sweep failed';
      return null;
    } finally {
      busy.value = false;
    }
  };

  return {
    busy,
    error,
    lastUserOpHash,
    balances,
    ethBalance,
    smartAccountAddress,
    isReady,
    sweep,
    refreshBalances,
  };
}

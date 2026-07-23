import { ref } from 'vue';
import {
  getTokenBalances,
  sweepAll,
  type SweepResult,
  type TokenBalance,
} from '@doiim/passkeys/smart-account';
import {
  createPublicClient,
  http,
  type Address,
  type PublicClient,
} from 'viem';
import type { BundlerClient } from 'viem/account-abstraction';

import { getActiveAaContext, readPasskeySession } from '@/blockchain/aaAccount';
import { useUser } from '@/composables/useUser';
import { env } from '@/config/env';
import { getErrorMessage } from '@/utils/error';

let publicClient: PublicClient | undefined;
let publicClientChainId: number | undefined;

/**
 * `sweepAll` transfers each requested token's full balance. The Pimlico fee
 * token must retain the quoted maximum until postOp, so sweeping it is unsafe.
 */
export const assertSweepPreservesPaymasterFeeToken = (
  tokenAddresses: readonly Address[],
  paymasterToken?: Address,
): void => {
  if (
    paymasterToken &&
    tokenAddresses.some(
      (token) => token.toLowerCase() === paymasterToken.toLowerCase(),
    )
  ) {
    throw new Error(
      'Cannot sweep the ERC-20 paymaster fee token because its balance must cover UserOperation gas',
    );
  }
};

export function usePasskeyAccount() {
  const user = useUser();
  const busy = ref(false);
  const error = ref<string | null>(null);
  const lastUserOpHash = ref<string | null>(null);
  const balances = ref<TokenBalance[]>([]);
  const ethBalance = ref<bigint>(0n);
  const smartAccountAddress = ref<Address | null>(
    readPasskeySession()?.smartAccountAddress ??
      user.walletAddress.value ??
      null,
  );

  const activeAa = user.network.value.aa;
  const isReady = Boolean(
    activeAa &&
    (activeAa.localSelfFunded ||
      env.passkey.pimlicoApiKey ||
      activeAa.bundlerUrl ||
      env.passkey.bundlerUrl),
  );

  const getPublicClient = (): PublicClient => {
    const chain = user.network.value;
    if (publicClient && publicClientChainId === chain.id) return publicClient;

    publicClient = createPublicClient({
      chain,
      transport: http(chain.rpcUrls.default.http[0]),
    });
    publicClientChainId = chain.id;
    return publicClient;
  };

  const getAaClient = async () => {
    const context = await getActiveAaContext();
    if (!context) throw new Error('AA context not available');
    smartAccountAddress.value = context.account.address;
    return context;
  };

  const refreshBalances = async (tokenAddresses: Address[]): Promise<void> => {
    try {
      const context = await getAaClient();
      const result = await getTokenBalances(
        getPublicClient(),
        context.account.address,
        tokenAddresses,
      );
      ethBalance.value = result.eth;
      balances.value = result.tokens;
    } catch (cause) {
      error.value = getErrorMessage(cause, 'Failed to fetch balances');
    }
  };

  const sweep = async (
    tokenAddresses: Address[],
    recipient: Address,
  ): Promise<SweepResult | null> => {
    busy.value = true;
    error.value = null;
    lastUserOpHash.value = null;
    try {
      const context = await getAaClient();
      if (context.fundingMode === 'paymaster') {
        assertSweepPreservesPaymasterFeeToken(
          tokenAddresses,
          context.network.aa?.paymasterPolicies.paidOperations?.token,
        );
      }

      // The normal paid-operation client always simulates against the real
      // token balance. Incoming-balance override remains release-only.
      const result = await sweepAll(
        context.erc20Client as unknown as BundlerClient,
        tokenAddresses,
        recipient,
      );
      lastUserOpHash.value = result.userOpHash;
      return result;
    } catch (cause) {
      error.value = getErrorMessage(cause, 'Sweep failed');
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
    readStoredSession: readPasskeySession,
  };
}

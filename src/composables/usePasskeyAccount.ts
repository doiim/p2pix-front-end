import { computed, ref } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import {
  getTokenBalances,
  type TokenBalance,
} from '@doiim/passkeys/smart-account';
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';

import { getAaOwnerKind, isAaAvailable } from '@/blockchain/aa/aaContext';
import {
  getActiveAaContext,
  sendAaOperation,
} from '@/blockchain/aa/operations';
import {
  discoverBalances,
  watchedTokens,
  type DiscoveredBalances,
} from '@/blockchain/balanceDiscovery';
import type { AaCall, AaContext } from '@/blockchain/aa/types';
import { getCurrentAccount, getPublicClient } from '@/blockchain/provider';
import { appendHistory } from '@/composables/account/userOpHistory';
import { useUser } from '@/composables/useUser';
import { TokenEnum, type NetworkConfig } from '@/model/NetworkEnum';
import { queryKeyRoots } from '@/queries/keys';
import { useWalletAddress } from '@/queries/wallet';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';

export type SendParams = {
  /** Symbol of the ERC-20 to move (BRZ or a swap token); absent means the native coin. */
  token?: string;
  amount: bigint;
  to: Address;
};

export type SendResult = { userOpHash: Hex; txHash?: Hex };

type Balances = {
  context: AaContext;
  result: { eth: bigint; tokens: TokenBalance[] };
};

/** The read entry for a token, matched by address rather than by list position. */
const balanceAt = (tokens: TokenBalance[], address: Address) => {
  const needle = address.toLowerCase();
  return tokens.find((token) => token.address.toLowerCase() === needle);
};

const findAddress = (network: NetworkConfig, symbol: string) =>
  watchedTokens(network).find((token) => token.symbol === symbol)?.address;

const addressOf = (network: NetworkConfig, symbol: string): Address => {
  const address = findAddress(network, symbol);
  if (!address) throw new Error(`Token desconhecido: ${symbol}`);
  return address;
};

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

/** `funds` carries the whole read: the sent token and the native coin differ. */
const assertSendFunds = (params: SendParams, funds: Balances): void => {
  const held =
    params.token === undefined
      ? funds.result.eth
      : (balanceAt(
          funds.result.tokens,
          addressOf(funds.context.network, params.token),
        )?.balance ?? 0n);
  if (held < params.amount) {
    throw new Error(
      params.token === undefined
        ? 'Saldo insuficiente'
        : `Saldo de ${params.token} insuficiente`,
    );
  }
};

// Module-level state: the account page and every screen inside it share one
// instance (same pattern as useUser). Balances live in the vue-query cache.
const busy = ref(false);
const error = ref<string | null>(null);
// Every network, not just the selected one: funds left on another chain.
const discovered = ref<DiscoveredBalances | null>(null);

export function usePasskeyAccount() {
  const user = useUser();
  const walletAddress = useWalletAddress();

  const isReady = computed(() => {
    if (!isAaAvailable(user.network.value)) return false;
    // The wallet address is part of the readiness check on purpose: a null
    // address means the AA smart account never resolved, so the account is
    // not actually usable even when an owner kind exists.
    return (
      Boolean(walletAddress.value) &&
      Boolean(getAaOwnerKind(getCurrentAccount().connector?.id))
    );
  });

  const readBalances = async (): Promise<Balances> => {
    const context = await getActiveAaContext();
    if (!context) throw new Error('Contexto da conta inteligente indisponível');
    const result = await getTokenBalances(
      getPublicClient(),
      context.account.address,
      watchedTokens(context.network).map((token) => token.address),
    );
    return {
      context,
      result,
    };
  };

  // The key carries the chain, so a read that resolves after a network switch
  // lands under the old key instead of overwriting the current one.
  const balancesQuery = useQuery({
    queryKey: computed(() => [
      ...queryKeyRoots.passkeyBalances,
      user.network.value.id,
      walletAddress.value,
    ]),
    queryFn: async () => {
      const { result } = await readBalances();
      return { eth: result.eth, tokens: result.tokens };
    },
    enabled: isReady,
    retry: false,
  });

  const balances = computed(() => balancesQuery.data.value?.tokens ?? []);
  const ethBalance = computed(() => balancesQuery.data.value?.eth ?? 0n);
  // Stays false on a failed read on purpose: consumers must render `error`
  // (never the loading state) when a read fails.
  const balancesLoaded = computed(() => Boolean(balancesQuery.data.value));

  // No token means the chain's native coin, which has its own read.
  const tokenRead = (token: string) => {
    const address = findAddress(user.network.value, token);
    return address && balanceAt(balances.value, address);
  };
  const symbolOf = (token?: string): string =>
    token ?? user.network.value.nativeCurrency.symbol;
  const decimalsOf = (token?: string): number =>
    (token === undefined ? undefined : tokenRead(token)?.decimals) ??
    user.network.value.nativeCurrency.decimals;
  const balanceOf = (token?: string): bigint =>
    token ? (tokenRead(token)?.balance ?? 0n) : ethBalance.value;
  // BRZ, the swap tokens in config order, then the native coin (no token).
  const assets = computed(() =>
    [
      ...watchedTokens(user.network.value).map(({ symbol }) => symbol),
      undefined,
    ].map((token) => ({
      token,
      symbol: symbolOf(token),
      image: token
        ? getTokenImage(token)
        : getNetworkImage(user.network.value.name),
    })),
  );

  const refreshBalances = async (): Promise<void> => {
    const result = await balancesQuery.refetch();
    if (!result.error) {
      error.value = null;
      return;
    }
    console.error('[account] balance read failed', result.error);
    error.value =
      result.error instanceof Error
        ? result.error.message
        : 'Falha ao buscar os saldos';
  };

  // Reads every network, so it runs on demand, never on each balance poll.
  const refreshDiscovered = async (): Promise<void> => {
    const owner = walletAddress.value;
    if (!owner) return;
    const found = await discoverBalances(owner);
    // The session may have changed while the networks were being read.
    if (walletAddress.value === owner) discovered.value = found;
  };

  const explorerTxUrl = (
    hash: Hex,
    network = user.network.value,
  ): string | null => {
    const base = network.blockExplorers?.default.url;
    return base ? `${base.replace(/\/$/, '')}/tx/${hash}` : null;
  };

  const send = async (params: SendParams): Promise<SendResult | null> => {
    if (busy.value) return null;
    busy.value = true;
    error.value = null;
    try {
      const funds = await readBalances();
      const { context } = funds;
      const calls: AaCall[] =
        params.token === undefined
          ? [{ to: params.to, value: params.amount, data: '0x' }]
          : [
              tokenTransfer(
                addressOf(context.network, params.token),
                params.to,
                params.amount,
              ),
            ];
      assertSendFunds(params, funds);

      const receipt = await sendAaOperation(
        context,
        calls,
        params.token === undefined
          ? undefined
          : {
              token: addressOf(context.network, params.token),
              amount: params.amount,
            },
      );
      const { userOpHash } = receipt;
      if (!receipt.success) {
        throw new Error(`Operação falhou na rede: ${userOpHash}`);
      }
      const txHash = receipt.receipt.transactionHash;
      // ponytail: history only knows TokenEnum; a swap-token send is not logged
      // (it would read as native coin); widen the entry type when Activity shows swap tokens.
      const logged = Object.values(TokenEnum).find((t) => t === params.token);
      if (params.token === undefined || logged) {
        appendHistory({
          id: userOpHash,
          token: logged,
          amount: params.amount.toString(),
          to: params.to,
          from: context.account.address,
          chainId: context.network.id,
          timestamp: Date.now(),
          txHash,
        });
      }
      await refreshBalances();
      void refreshDiscovered();
      return { userOpHash, txHash };
    } catch (cause) {
      console.error('[account] send failed', cause);
      error.value = cause instanceof Error ? cause.message : 'Falha ao enviar';
      return null;
    } finally {
      busy.value = false;
    }
  };

  /** Forget the error of the previous chain/session; the balances are keyed
   * by both, so they need no clearing. */
  const reset = (): void => {
    discovered.value = null;
    error.value = null;
  };

  return {
    busy,
    error,
    balancesLoaded,
    balances,
    ethBalance,
    discovered,
    // The connected address is the smart account: one source.
    smartAccountAddress: walletAddress,
    isReady,
    symbolOf,
    decimalsOf,
    balanceOf,
    assets,
    send,
    refreshBalances,
    refreshDiscovered,
    explorerTxUrl,
    reset,
  };
}

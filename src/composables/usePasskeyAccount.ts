import { computed, ref } from 'vue';
import {
  getTokenBalances,
  type TokenBalance,
} from '@doiim/passkeys/smart-account';
import {
  encodeFunctionData,
  erc20Abi,
  zeroAddress,
  type Address,
  type Hex,
} from 'viem';

import { isAaAvailable } from '@/blockchain/aa/aaContext';
import {
  getActiveAaContext,
  sendAaOperation,
} from '@/blockchain/aa/operations';
import { getAaOwnerKind, readPasskeySession } from '@/blockchain/aa/session';
import type { AaCall, AaContext } from '@/blockchain/aa/types';
import { getCurrentAccount, getPublicClient } from '@/blockchain/provider';
import { appendHistory } from '@/composables/account/userOpHistory';
import { useUser } from '@/composables/useUser';
import type { TokenEnum } from '@/model/NetworkEnum';

export type SendParams = {
  /** ERC-20 to move; absent means the chain's native coin. */
  token?: TokenEnum;
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
          funds.context.network.tokens[params.token].address,
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
// instance (same pattern as useUser).
const busy = ref(false);
const error = ref<string | null>(null);
const balancesLoaded = ref(false);
const balances = ref<TokenBalance[]>([]);
const ethBalance = ref<bigint>(0n);
const smartAccountAddress = ref<Address | null>(null);

export function usePasskeyAccount() {
  const user = useUser();

  const isReady = computed(() => {
    if (!isAaAvailable(user.network.value)) return false;
    // The wallet address is part of the readiness check on purpose: a null
    // address means the AA smart account never resolved, so the account is
    // not actually usable even when an owner kind exists.
    return (
      Boolean(user.walletAddress.value) &&
      Boolean(getAaOwnerKind(getCurrentAccount().connector?.id))
    );
  });

  // No token means the chain's native coin, which has its own read.
  const tokenRead = (token: TokenEnum) =>
    balanceAt(balances.value, user.network.value.tokens[token].address);
  const symbolOf = (token?: TokenEnum): string =>
    token ?? user.network.value.nativeCurrency.symbol;
  const decimalsOf = (token?: TokenEnum): number =>
    (token && tokenRead(token)?.decimals) ??
    user.network.value.nativeCurrency.decimals;
  const balanceOf = (token?: TokenEnum): bigint =>
    token ? (tokenRead(token)?.balance ?? 0n) : ethBalance.value;

  const readBalances = async (): Promise<Balances> => {
    const context = await getActiveAaContext();
    if (!context) throw new Error('Contexto da conta inteligente indisponível');
    smartAccountAddress.value = context.account.address;
    const result = await getTokenBalances(
      getPublicClient(),
      context.account.address,
      Object.values(context.network.tokens).map((token) => token.address),
    );
    return {
      context,
      result,
    };
  };

  const refreshBalances = async (): Promise<void> => {
    try {
      const { context, result } = await readBalances();
      // A network switch may have happened while this request was in flight.
      if (context.network.id !== user.network.value.id) return;
      ethBalance.value = result.eth;
      balances.value = result.tokens;
      balancesLoaded.value = true;
    } catch (cause) {
      // `balancesLoaded` stays false on purpose: consumers must render `error`
      // (never the loading state) when a read fails.
      error.value =
        cause instanceof Error ? cause.message : 'Falha ao buscar os saldos';
    }
  };

  const explorerTxUrl = (hash: Hex): string | null => {
    const base = user.network.value.blockExplorers?.default.url;
    return base ? `${base.replace(/\/$/, '')}/tx/${hash}` : null;
  };

  const send = async (params: SendParams): Promise<SendResult | null> => {
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
                context.network.tokens[params.token].address,
                params.to,
                params.amount,
              ),
            ];
      assertSendFunds(params, funds);

      // Unset fee token: sendAaOperation sponsors before reading either
      // argument, so the zero address placeholder is never used.
      const feeToken = context.network.aa?.feeToken;
      const receipt = await sendAaOperation(
        context,
        calls,
        feeToken ? context.network.tokens[feeToken].address : zeroAddress,
        feeToken && params.token === feeToken ? params.amount : 0n,
      );
      const { userOpHash } = receipt;
      if (!receipt.success) {
        throw new Error(`Operação falhou na rede: ${userOpHash}`);
      }
      const txHash = receipt.receipt.transactionHash;
      appendHistory({
        id: userOpHash,
        token: params.token,
        amount: params.amount.toString(),
        to: params.to,
        from: context.account.address,
        chainId: context.network.id,
        timestamp: Date.now(),
        txHash,
      });
      await refreshBalances();
      return { userOpHash, txHash };
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : 'Falha ao enviar';
      return null;
    } finally {
      busy.value = false;
    }
  };

  /** Forget everything tied to the previous chain/session. */
  const reset = (): void => {
    smartAccountAddress.value =
      user.walletAddress.value ??
      readPasskeySession()?.smartAccountAddress ??
      null;
    balances.value = [];
    ethBalance.value = 0n;
    balancesLoaded.value = false;
    error.value = null;
  };

  return {
    busy,
    error,
    balancesLoaded,
    balances,
    ethBalance,
    smartAccountAddress,
    isReady,
    symbolOf,
    decimalsOf,
    balanceOf,
    send,
    refreshBalances,
    explorerTxUrl,
    reset,
  };
}

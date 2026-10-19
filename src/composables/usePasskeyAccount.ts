import { computed, ref } from 'vue';
import {
  getTokenBalances,
  type TokenBalance,
} from '@doiim/passkeys/smart-account';
import { encodeFunctionData, erc20Abi, type Address, type Hex } from 'viem';

import { isAaAvailable } from '@/blockchain/aa/aaContext';
import {
  getActiveAaContext,
  sendAaOperation,
} from '@/blockchain/aa/operations';
import {
  InsufficientFeeTokenBalanceError,
  prepareErc20PaymasterQuote,
} from '@/blockchain/aa/paymasters/erc20';
import { getAaOwnerKind, readPasskeySession } from '@/blockchain/aa/session';
import type { AaCall, AaContext } from '@/blockchain/aa/types';
import { getCurrentAccount, getPublicClient } from '@/blockchain/provider';
import { appendHistory } from '@/composables/account/userOpHistory';
import { useUser } from '@/composables/useUser';
import { listTokens } from '@/config/networks';
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

const tokenAddress = (context: AaContext, token: TokenEnum): Address => {
  const listed = context.network.tokens[token];
  if (!listed) throw new Error(`${token} não está disponível nesta rede`);
  return listed.address;
};

/** Moves `amount` of `token` to `to`; no token means the native coin. */
const transferCall = (
  context: AaContext,
  token: TokenEnum | undefined,
  to: Address,
  amount: bigint,
): AaCall =>
  token === undefined
    ? { to, value: amount, data: '0x' }
    : tokenTransfer(tokenAddress(context, token), to, amount);

/** `funds` carries the whole read: the sent token and the native coin differ. */
const assertSendFunds = (params: SendParams, funds: Balances): void => {
  const held =
    params.token === undefined
      ? funds.result.eth
      : (balanceAt(
          funds.result.tokens,
          tokenAddress(funds.context, params.token),
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
  const tokenRead = (token: TokenEnum) => {
    const listed = user.network.value.tokens[token];
    return listed && balanceAt(balances.value, listed.address);
  };
  const symbolOf = (token?: TokenEnum): string =>
    token ?? user.network.value.nativeCurrency.symbol;
  const decimalsOf = (token?: TokenEnum): number =>
    (token && user.network.value.tokens[token]?.decimals) ??
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
      listTokens(context.network).map((token) => token.address),
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
      const calls = [
        transferCall(context, params.token, params.to, params.amount),
      ];
      assertSendFunds(params, funds);

      const feeToken = context.network.aa?.feeToken;
      const receipt = await sendAaOperation(
        context,
        calls,
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

  /**
   * The fee a send pays in the network's fee token: a quote for a 1-unit probe
   * plus 20% headroom, as the cost depends on the call's shape, not its
   * amount. 0 when the send is sponsored: no fee token is set, or the account
   * holds too little of it.
   */
  const quoteFee = async (
    token: TokenEnum | undefined,
    to: Address,
  ): Promise<bigint> => {
    const context = await getActiveAaContext();
    if (!context?.network.aa?.feeToken) return 0n;
    const probe = await prepareErc20PaymasterQuote(context, [
      transferCall(context, token, to, 1n),
    ]).catch((cause) => {
      if (cause instanceof InsufficientFeeTokenBalanceError) return null;
      throw cause;
    });
    return probe ? (probe.costInToken * 12n) / 10n : 0n;
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
    quoteFee,
    refreshBalances,
    explorerTxUrl,
    reset,
  };
}

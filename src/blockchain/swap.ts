// Post-release swap: once `release` pays BRZ to the buyer, the buyer's own
// account places a CoW order BRZ → chosen token. P2Pix never holds or routes
// anything but BRZ; a failed swap always leaves the buyer with the BRZ.

import {
  erc20Abi,
  parseUnits,
  type Address,
  type Hex,
  type WalletClient,
} from 'viem';
import { getActiveAaContext } from './aa/operations';
import { getSender, sendContractCalls } from './send';
import type { AaCall } from './aa/types';
import { getBuyerLock, releaseCall, releaseLock } from './buyerMethods';
import type { PixProof } from '@/utils/pixProof';
import { getPublicClient, getWalletClient } from './provider';
import {
  CANCELLATION_TYPES,
  ORDER_TYPES,
  buildOrder,
  cancelPresignCalls,
  lockAmountFor,
  orderDomain,
  orderUid,
  presignCalls,
  priceImpactBps,
  settlementAbi,
  withHeadroom,
  type CowOrder,
  type SettlementContracts,
} from './cowOrder';
import {
  cancelOrders,
  getOrder,
  postOrder,
  quote,
  type OrderState,
} from '@/utils/cowApi';
import { useUser } from '@/composables/useUser';
import {
  TokenEnum,
  type NetworkConfig,
  type SwapConfig,
  type SwapToken,
} from '@/model/NetworkEnum';
import { findSwapToken } from '@/model/BuyToken';
import { MIN_FEE_BALANCE_WEI_DEFAULT } from '@/config/aa';

/** Slippage accepted by a re-quote, which sells the BRZ already in the account. */
const REQUOTE_SLIPPAGE_BPS = 100n;

/** Price impact above this shows a warning; it never blocks the buyer. */
export const IMPACT_WARN_BPS = 100;

/** What the buyer asked for: a configured token symbol and a decimal amount. */
export type SwapIntent = { token: string; amount: string };

/**
 * Search screen: how much BRZ (= R$) to lock so the buyer gets
 * `intent.buyAmount`, and the price impact against a trade 1% its size.
 */
export const quoteLock = async (intent: SwapIntent, from: Address) => {
  const ctx = swapContext();
  const target = await resolve(ctx, intent);
  const { real, impactBps } = await quoteWithImpact(
    ctx,
    { sellToken: brz(ctx.network), buyToken: target.token.address, from },
    target.buyAmount,
    // Not one whole token: 1 WETH outweighs most purchases.
    target.buyAmount / 100n,
  );
  return {
    lockAmount: lockAmountFor(
      real.sellAmount + real.feeAmount,
      feeReserve(ctx.network),
    ),
    impactBps,
  };
};

/**
 * Sell screen: how much of `symbol` buys `brzAmount` BRZ for the deposit, and
 * the price impact against a small reference trade.
 */
export const quoteBrzCost = async (
  symbol: string,
  brzAmount: bigint,
  from: Address,
) => {
  const ctx = swapContext();
  const token = swapToken(ctx, symbol);
  const { real, impactBps } = await quoteWithImpact(
    ctx,
    { sellToken: token.address, buyToken: brz(ctx.network), from },
    brzAmount,
    SELL_REFERENCE_BRZ,
  );
  return {
    cost: real.sellAmount + real.feeAmount,
    decimals: await tokenDecimals(ctx.network, token.address),
    impactBps,
  };
};

/**
 * Sell side: buys exactly `brzAmount` BRZ with `symbol` from the seller's own
 * account, before the deposit. The order may spend the quote plus headroom.
 */
export const buyBrz = async (symbol: string, brzAmount: bigint) => {
  const ctx = swapContext();
  const token = swapToken(ctx, symbol);
  const aa = await getActiveAaContext();
  const owner = aa ? aa.account.address : (await eoa()).account;
  const q = await quote(ctx.swap, {
    sellToken: token.address,
    buyToken: brz(ctx.network),
    from: owner,
    kind: 'buy',
    amount: brzAmount,
  });
  const order = buildOrder({
    owner,
    sellToken: token.address,
    buyToken: brz(ctx.network),
    sellAmount: withHeadroom(q.sellAmount + q.feeAmount),
    buyAmount: brzAmount,
    kind: 'buy',
    now: nowSeconds(),
  });
  return aa ? placeAa(ctx, order, owner) : placeEoa(ctx, order, owner);
};

/**
 * Releases the lock and places the buyer's order. Returns the release's block
 * and the order uid, or a null uid when only BRZ was delivered (price moved past the lock's headroom, or
 * the order book failed) — the UI then offers a re-quote.
 *
 * Smart account: the order is posted first as `presign`, then release +
 * approve + `setPreSignature` run as one UserOperation. EOA with atomic
 * batching (EIP-5792): the same three calls in one wallet prompt. Other EOAs:
 * release, then approve + EIP-712 signature (see `separatePrompts`).
 */
export const releaseAndSwap = async (
  lockID: bigint,
  proof: PixProof,
  intent: SwapIntent,
): Promise<Released> => {
  const release: ReleaseArgs = [lockID, proof];
  // The Pix is paid: without a swap config on this chain, just release.
  if (!useUser().network.value.swap) return releaseOnly(release);
  const ctx = swapContext();
  const aa = await getActiveAaContext();
  const owner = aa ? aa.account.address : (await eoa()).account;
  const order = await getBuyerLock(lockID, owner)
    .then((lock) => priceBuyOrder(ctx, intent, owner, lock.amount))
    .catch(deliverBrzOnly('quote'));
  if (!order) return releaseOnly(release);
  // The release rides with the order's calls; if that bundle fails, release
  // alone so a swap step never holds the paid BRZ back.
  return (
    aa
      ? releaseWithOrderAa(ctx, release, owner, order)
      : releaseWithOrderEoa(ctx, release, owner, order)
  ).catch((cause) => {
    deliverBrzOnly('release with order')(cause);
    return releaseOnly(release);
  });
};

const releaseOnly = async (release: ReleaseArgs): Promise<Released> => {
  const receipt = await releaseLock(...release);
  return { uid: null, blockNumber: receipt.blockNumber };
};

/** `release`'s own arguments: the lock id and the Pix proof. */
type ReleaseArgs = Parameters<typeof releaseCall>;

type Released = { uid: Hex | null; blockNumber: bigint };

const releaseWithOrderAa = async (
  ctx: SwapContext,
  release: ReleaseArgs,
  owner: Address,
  order: CowOrder,
): Promise<Released> => {
  const uid = await submit(ctx, order, owner, presigned(owner)).catch(
    deliverBrzOnly('order'),
  );
  const receipt = await releaseLock(
    ...release,
    uid ? presignCalls(await contractsOf(ctx), order, uid) : [],
  );
  return { uid, blockNumber: receipt.blockNumber };
};

const releaseWithOrderEoa = async (
  ctx: SwapContext,
  release: ReleaseArgs,
  owner: Address,
  order: CowOrder,
): Promise<Released> => {
  const { wallet } = await eoa();
  const uid = (await canBatchAtomically(wallet, owner, ctx.network.id))
    ? await submit(ctx, order, owner, presigned(owner)).catch(
        deliverBrzOnly('order'),
      )
    : null;
  if (uid) {
    const blockNumber = await sendAtomic(ctx, wallet, owner, [
      await releaseCall(...release),
      ...presignCalls(await contractsOf(ctx), order, uid),
    ]);
    return { uid, blockNumber };
  }
  const receipt = await releaseLock(...release);
  return {
    uid: await placeEoa(ctx, order, owner).catch(deliverBrzOnly('order')),
    blockNumber: receipt.blockNumber,
  };
};

export type WalletPrompt = 'release' | 'approve' | 'sign';

/**
 * The separate wallet prompts a flow will raise, in order, so the UI can say
 * up front that they all belong to this trade. Empty when it is a single
 * prompt: a smart account, or an EOA wallet with atomic batching (EIP-5792).
 */
export const separatePrompts = async (
  withRelease: boolean,
): Promise<WalletPrompt[]> => {
  if (await getActiveAaContext()) return [];
  const { wallet, account } = await eoa();
  if (await canBatchAtomically(wallet, account, useUser().network.value.id)) {
    return [];
  }
  return withRelease ? ['release', 'approve', 'sign'] : ['approve', 'sign'];
};

/** Sells the BRZ now in the account at the current price. */
export const requoteSwap = async (symbol: string): Promise<Hex> => {
  const ctx = swapContext();
  const token = swapToken(ctx, symbol);
  const aa = await getActiveAaContext();
  const owner = aa ? aa.account.address : (await eoa()).account;
  const sellToken = brz(ctx.network);
  const balance = await getPublicClient().readContract({
    address: sellToken,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  });
  const sellAmount = balance - feeReserve(ctx.network);
  if (sellAmount <= 0n) throw new Error('No BRZ left to swap');

  const q = await quote(ctx.swap, {
    sellToken,
    buyToken: token.address,
    from: owner,
    kind: 'sell',
    amount: sellAmount,
  });
  const order = buildOrder({
    owner,
    sellToken,
    buyToken: token.address,
    sellAmount,
    buyAmount: (q.buyAmount * (10_000n - REQUOTE_SLIPPAGE_BPS)) / 10_000n,
    kind: 'sell',
    now: nowSeconds(),
  });
  return aa ? placeAa(ctx, order, owner) : placeEoa(ctx, order, owner);
};

/** Withdraws a live order so `sellToken` stays in the account. */
export const cancelSwap = async (
  uid: Hex,
  sellToken: Address,
): Promise<void> => {
  const ctx = swapContext();
  const aa = await getActiveAaContext();
  if (aa) {
    const { success, receipt } = await sendContractCalls(
      await getSender(),
      cancelPresignCalls(await contractsOf(ctx), sellToken, uid),
      { aaOnly: true },
    );
    if (!success) {
      throw new Error(`AA cancel failed: ${receipt.transactionHash}`);
    }
    return;
  }
  const { wallet, account } = await eoa();
  await assertWalletChain(ctx.network);
  const cancellation = await wallet.signTypedData({
    account,
    domain: orderDomain(ctx.network.id, ctx.swap.settlement),
    types: CANCELLATION_TYPES,
    primaryType: 'OrderCancellations',
    message: { orderUids: [uid] },
  });
  await cancelOrders(ctx.swap, [uid], cancellation);
};

export const getSwapOrder = (uid: Hex): Promise<OrderState> =>
  getOrder(swapContext().swap, uid);

/** Read once per chain and token from the token contract itself. */
export const tokenDecimals = (network: NetworkConfig, address: Address) =>
  cached(`${network.id}:${address}:decimals`, () =>
    getPublicClient().readContract({
      address,
      abi: erc20Abi,
      functionName: 'decimals',
    }),
  );

/** Survives a reload between lock and release; losing it only means BRZ-only. */
export const saveSwapIntent = (
  chainId: number,
  lockID: string,
  intent: SwapIntent,
) => sessionStorage.setItem(intentKey(chainId, lockID), JSON.stringify(intent));

export const loadSwapIntent = (
  chainId: number,
  lockID: string,
): SwapIntent | null => {
  const raw: unknown = JSON.parse(
    sessionStorage.getItem(intentKey(chainId, lockID)) ?? 'null',
  );
  return typeof raw === 'object' &&
    raw !== null &&
    'token' in raw &&
    'amount' in raw &&
    typeof raw.token === 'string' &&
    typeof raw.amount === 'string' &&
    /^\d+(\.\d+)?$/.test(raw.amount)
    ? { token: raw.token, amount: raw.amount }
    : null;
};

type SwapContext = { network: NetworkConfig; swap: SwapConfig };

const swapContext = (): SwapContext => {
  const network = useUser().network.value;
  if (!network.swap) throw new Error('Swap is not available on this network');
  return { network, swap: network.swap };
};

const brz = (network: NetworkConfig) => network.tokens[TokenEnum.BRZ].address;

/** BRZ kept back for the paymaster's charge on the smart-account rail. */
const feeReserve = (network: NetworkConfig) =>
  network.aa?.minFeeBalance ?? MIN_FEE_BALANCE_WEI_DEFAULT;

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** About one stablecoin's worth of BRZ: the sell side's reference trade. */
const SELL_REFERENCE_BRZ = 5n * 10n ** 18n;

/**
 * A live buy quote for `amount` and a small `referenceAmount` one, compared
 * per unit: the price impact the buyer or seller sees before signing.
 */
const quoteWithImpact = async (
  ctx: SwapContext,
  pair: { sellToken: Address; buyToken: Address; from: Address },
  amount: bigint,
  referenceAmount: bigint,
) => {
  const request = {
    ...pair,
    kind: 'buy' as const,
    priceQuality: 'fast' as const,
  };
  const [real, reference] = await Promise.all([
    quote(ctx.swap, { ...request, amount }),
    quote(ctx.swap, { ...request, amount: referenceAmount }),
  ]);
  return { real, impactBps: priceImpactBps(real, reference) };
};

const swapToken = (ctx: SwapContext, symbol: string): SwapToken => {
  const token = findSwapToken(ctx.network, symbol);
  if (!token) throw new Error(`${symbol} is not a swap token on this network`);
  return token;
};

const resolve = async (ctx: SwapContext, intent: SwapIntent) => {
  const token = swapToken(ctx, intent.token);
  const decimals = await tokenDecimals(ctx.network, token.address);
  return { token, buyAmount: parseUnits(intent.amount, decimals) };
};

/** The relayer is whatever the settlement contract says it is. */
const contractsOf = async (ctx: SwapContext): Promise<SettlementContracts> => ({
  settlement: ctx.swap.settlement,
  vaultRelayer: await cached(`${ctx.network.id}:vaultRelayer`, () =>
    getPublicClient().readContract({
      address: ctx.swap.settlement,
      abi: settlementAbi,
      functionName: 'vaultRelayer',
    }),
  ),
});

const cache = new Map<string, Promise<unknown>>();

/** Memoizes immutable on-chain reads; a failed read is retried next time. */
const cached = <T>(key: string, read: () => Promise<T>): Promise<T> => {
  const hit = cache.get(key);
  if (hit) return hit as Promise<T>;
  const pending = read();
  cache.set(key, pending);
  pending.catch(() => cache.delete(key));
  return pending;
};

// Lock ids are per-contract counters: lock #N exists on every chain. Without
// the chain in the key, a BRZ-only purchase on chain B picked up the swap
// intent of lock #N on chain A and prompted a swap nobody asked for.
const intentKey = (chainId: number, lockID: string) =>
  `p2pix:swap-intent:${chainId}:${lockID}`;

/**
 * Buy order capped at the released BRZ minus the fee reserve. Null when the
 * current price no longer fits that cap: posting it would just sit unfilled.
 */
const priceBuyOrder = async (
  ctx: SwapContext,
  intent: SwapIntent,
  owner: Address,
  released: bigint,
): Promise<CowOrder | null> => {
  const sellLimit = released - feeReserve(ctx.network);
  const target = await resolve(ctx, intent);
  const q = await quote(ctx.swap, {
    sellToken: brz(ctx.network),
    buyToken: target.token.address,
    from: owner,
    kind: 'buy',
    amount: target.buyAmount,
  });
  return q.sellAmount + q.feeAmount > sellLimit
    ? null
    : buildOrder({
        owner,
        sellToken: brz(ctx.network),
        buyToken: target.token.address,
        sellAmount: sellLimit,
        buyAmount: target.buyAmount,
        kind: 'buy',
        now: nowSeconds(),
      });
};

/** Posts the order and refuses a uid that differs from the one we signed for. */
const submit = async (
  ctx: SwapContext,
  order: CowOrder,
  owner: Address,
  signing: { scheme: 'eip712' | 'presign'; signature: Hex },
): Promise<Hex> => {
  const uid = await postOrder(ctx.swap, order, owner, signing);
  const expected = orderUid(order, owner, ctx.network.id, ctx.swap.settlement);
  if (uid.toLowerCase() !== expected.toLowerCase()) {
    throw new Error(`Order book returned uid ${uid}, expected ${expected}`);
  }
  return uid;
};

const placeAa = async (
  ctx: SwapContext,
  order: CowOrder,
  owner: Address,
): Promise<Hex> => {
  const uid = await submit(ctx, order, owner, presigned(owner));
  const { success, receipt } = await sendContractCalls(
    await getSender(),
    presignCalls(await contractsOf(ctx), order, uid),
    {
      aaOnly: true,
      outflow: { token: order.sellToken, amount: order.sellAmount },
    },
  );
  if (!success) {
    throw new Error(`AA presign failed: ${receipt.transactionHash}`);
  }
  return uid;
};

const placeEoa = async (
  ctx: SwapContext,
  order: CowOrder,
  owner: Address,
): Promise<Hex> => {
  const { wallet } = await eoa();
  if (await canBatchAtomically(wallet, owner, ctx.network.id)) {
    const uid = await submit(ctx, order, owner, presigned(owner));
    await sendAtomic(
      ctx,
      wallet,
      owner,
      presignCalls(await contractsOf(ctx), order, uid),
    );
    return uid;
  }
  await assertWalletChain(ctx.network);
  const { vaultRelayer } = await contractsOf(ctx);
  const client = getPublicClient();
  const allowance = await client.readContract({
    address: order.sellToken,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, vaultRelayer],
  });
  if (allowance < order.sellAmount) {
    const hash = await wallet.writeContract({
      address: order.sellToken,
      abi: erc20Abi,
      functionName: 'approve',
      args: [vaultRelayer, order.sellAmount],
      account: owner,
      chain: ctx.network,
    });
    await client.waitForTransactionReceipt({ hash });
  }
  const signature = await wallet.signTypedData({
    account: owner,
    domain: orderDomain(ctx.network.id, ctx.swap.settlement),
    types: ORDER_TYPES,
    primaryType: 'Order',
    message: order,
  });
  return submit(ctx, order, owner, { scheme: 'eip712', signature });
};

/** `presign` carries the owner as its signature; `setPreSignature` arms it. */
const presigned = (owner: Address) => ({
  scheme: 'presign' as const,
  signature: owner,
});

/**
 * EIP-5792: the wallet runs a call batch atomically as the EOA itself, so
 * `release` still credits the buyer. `ready` means after a one-time EIP-7702
 * upgrade prompt (MetaMask). Wallets without EIP-5792 reject the method.
 */
const canBatchAtomically = async (
  wallet: WalletClient,
  account: Address,
  chainId: number,
) => {
  const capabilities = await wallet
    .getCapabilities({ account, chainId })
    .catch(() => null);
  const status = capabilities?.atomic?.status;
  return status === 'supported' || status === 'ready';
};

const sendAtomic = async (
  ctx: SwapContext,
  wallet: WalletClient,
  account: Address,
  calls: AaCall[],
) => {
  await assertWalletChain(ctx.network);
  const { id } = await wallet.sendCalls({
    account,
    chain: ctx.network,
    calls,
    forceAtomic: true,
  });
  const result = await wallet.waitForCallsStatus({ id });
  if (result.status !== 'success') {
    throw new Error(`Batched calls failed: ${id}`);
  }
  // EIP-5792 returns receipts on success; without one the limit read just skips its block floor.
  return result.receipts?.at(-1)?.blockNumber ?? 0n;
};

const eoa = async () => {
  const wallet = await getWalletClient();
  const [account] = wallet ? await wallet.getAddresses() : [];
  if (!wallet || !account) throw new Error('Wallet not connected');
  return { wallet, account };
};

/** The order domain pins the chain; a wallet on another chain must not sign. */
const assertWalletChain = async (network: NetworkConfig) => {
  const { wallet } = await eoa();
  if ((await wallet.getChainId()) !== network.id) {
    throw new Error(`Wallet is not on ${network.name}`);
  }
};

/**
 * The Pix is already paid, so a swap failure must never block the release:
 * log it and fall back to delivering BRZ, which the UI then offers to re-quote.
 */
const deliverBrzOnly = (step: string) => (cause: unknown) => {
  console.error(`[swap] ${step} failed; delivering BRZ only`, cause);
  return null;
};

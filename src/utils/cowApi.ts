// CoW Protocol order book API (https://docs.cow.fi). Every response is
// external JSON, so it is shape-checked here before anything else reads it.

import { isHex, type Address, type Hex } from 'viem';
import { APP_DATA, type SwapConfig } from '@/config/swap';
import type { CowOrder, OrderKind } from '@/blockchain/cowOrder';

export type Quote = {
  sellAmount: bigint;
  buyAmount: bigint;
  feeAmount: bigint;
};

export type QuoteRequest = {
  sellToken: Address;
  buyToken: Address;
  from: Address;
  kind: OrderKind;
  /** Buy amount for `buy`, sell amount for `sell`. */
  amount: bigint;
  /** `fast` (~1 s) suits a live preview; the API default (`optimal`) takes seconds. */
  priceQuality?: 'fast' | 'optimal';
};

export const ORDER_STATUSES = [
  'presignaturePending',
  'open',
  'fulfilled',
  'cancelled',
  'expired',
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type OrderState = { status: OrderStatus; executedBuyAmount: bigint };

export class CowApiError extends Error {
  constructor(
    readonly errorType: string,
    description: string,
  ) {
    super(`CoW API ${errorType}: ${description}`);
    this.name = 'CowApiError';
  }
}

export const quote = async (
  swap: SwapConfig,
  request: QuoteRequest,
): Promise<Quote> => {
  const amountField =
    request.kind === 'buy' ? 'buyAmountAfterFee' : 'sellAmountBeforeFee';
  const body = await call(swap, '/api/v1/quote', 'POST', {
    sellToken: request.sellToken,
    buyToken: request.buyToken,
    from: request.from,
    receiver: request.from,
    kind: request.kind,
    [amountField]: String(request.amount),
    appData: APP_DATA,
    priceQuality: request.priceQuality,
  });
  const q = isRecord(body) ? body.quote : undefined;
  if (
    !isRecord(q) ||
    !sameAddress(q.sellToken, request.sellToken) ||
    !sameAddress(q.buyToken, request.buyToken) ||
    q.kind !== request.kind ||
    !isUint(q.sellAmount) ||
    !isUint(q.buyAmount) ||
    !isUint(q.feeAmount)
  ) {
    throw new CowApiError('MalformedResponse', 'unexpected quote shape');
  }
  return {
    sellAmount: BigInt(q.sellAmount),
    buyAmount: BigInt(q.buyAmount),
    feeAmount: BigInt(q.feeAmount),
  };
};

/**
 * `presign` carries the owner address as its signature; the order stays
 * unfillable until `setPreSignature` runs on-chain.
 */
export const postOrder = async (
  swap: SwapConfig,
  order: CowOrder,
  owner: Address,
  signing: { scheme: 'eip712' | 'presign'; signature: Hex },
): Promise<Hex> => {
  const uid = await call(swap, '/api/v1/orders', 'POST', {
    ...order,
    sellAmount: String(order.sellAmount),
    buyAmount: String(order.buyAmount),
    feeAmount: String(order.feeAmount),
    appData: APP_DATA,
    appDataHash: order.appData,
    signingScheme: signing.scheme,
    signature: signing.signature,
    from: owner,
  });
  // 32-byte digest + 20-byte owner + 4-byte validTo.
  if (!isHex(uid) || uid.length !== 2 + 56 * 2) {
    throw new CowApiError('MalformedResponse', 'unexpected order uid');
  }
  return uid;
};

export const getOrder = async (
  swap: SwapConfig,
  uid: Hex,
): Promise<OrderState> => {
  const body = await call(swap, `/api/v1/orders/${uid}`, 'GET');
  if (
    !isRecord(body) ||
    !isOrderStatus(body.status) ||
    !isUint(body.executedBuyAmount)
  ) {
    throw new CowApiError('MalformedResponse', 'unexpected order shape');
  }
  return {
    status: body.status,
    executedBuyAmount: BigInt(body.executedBuyAmount),
  };
};

/** Off-chain cancellation, signed over `OrderCancellations` (no gas). */
export const cancelOrders = async (
  swap: SwapConfig,
  orderUids: Hex[],
  signature: Hex,
): Promise<void> => {
  await call(swap, '/api/v1/orders', 'DELETE', {
    orderUids,
    signature,
    signingScheme: 'eip712',
  });
};

const call = async (
  swap: SwapConfig,
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: Record<string, unknown>,
): Promise<unknown> => {
  const response = await fetch(`${swap.apiUrl}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  // Some errors (e.g. a malformed uid in the path) come back as plain text.
  const json: unknown = response.headers
    .get('content-type')
    ?.includes('application/json')
    ? await response.json()
    : await response.text();
  if (response.ok) return json;
  throw isRecord(json) && typeof json.errorType === 'string'
    ? new CowApiError(json.errorType, String(json.description ?? ''))
    : new CowApiError(`HTTP${response.status}`, response.statusText);
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const isOrderStatus = (v: unknown): v is OrderStatus =>
  ORDER_STATUSES.some((s) => s === v);

const isUint = (v: unknown): v is string =>
  typeof v === 'string' && /^\d+$/.test(v);

const sameAddress = (v: unknown, expected: Address) =>
  typeof v === 'string' && v.toLowerCase() === expected.toLowerCase();

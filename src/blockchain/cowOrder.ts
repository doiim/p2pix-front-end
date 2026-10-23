// Pure CoW Protocol order logic: EIP-712 types, order UID and the amounts the
// buy flow derives from a quote. No network access, so it is unit-testable.

import {
  encodeFunctionData,
  encodePacked,
  erc20Abi,
  hashTypedData,
  keccak256,
  parseAbi,
  toBytes,
  type Address,
  type Hex,
} from 'viem';
import type { AaCall } from './aa/types';
import {
  APP_DATA,
  LOCK_SLIPPAGE_BPS,
  ORDER_VALIDITY_SECONDS,
} from '@/config/swap';

export type OrderKind = 'buy' | 'sell';

/** GPv2 order as signed; field order and names are fixed by the protocol. */
export type CowOrder = {
  sellToken: Address;
  buyToken: Address;
  receiver: Address;
  sellAmount: bigint;
  buyAmount: bigint;
  validTo: number;
  appData: Hex;
  feeAmount: bigint;
  kind: OrderKind;
  partiallyFillable: boolean;
  sellTokenBalance: 'erc20';
  buyTokenBalance: 'erc20';
};

export const ORDER_TYPES = {
  Order: [
    { name: 'sellToken', type: 'address' },
    { name: 'buyToken', type: 'address' },
    { name: 'receiver', type: 'address' },
    { name: 'sellAmount', type: 'uint256' },
    { name: 'buyAmount', type: 'uint256' },
    { name: 'validTo', type: 'uint32' },
    { name: 'appData', type: 'bytes32' },
    { name: 'feeAmount', type: 'uint256' },
    { name: 'kind', type: 'string' },
    { name: 'partiallyFillable', type: 'bool' },
    { name: 'sellTokenBalance', type: 'string' },
    { name: 'buyTokenBalance', type: 'string' },
  ],
} as const;

export const CANCELLATION_TYPES = {
  OrderCancellations: [{ name: 'orderUids', type: 'bytes[]' }],
} as const;

export const settlementAbi = parseAbi([
  'function setPreSignature(bytes orderUid, bool signed)',
  'function vaultRelayer() view returns (address)',
]);

/** GPv2Settlement and the relayer it pulls sell tokens through. */
export type SettlementContracts = {
  settlement: Address;
  vaultRelayer: Address;
};

export const APP_DATA_HASH = keccak256(toBytes(APP_DATA));

export const orderDomain = (chainId: number, settlement: Address) => ({
  name: 'Gnosis Protocol',
  version: 'v2',
  chainId,
  verifyingContract: settlement,
});

/**
 * Built locally from the buyer's intent: the API only contributes a price, so
 * a compromised quote can never redirect `receiver` or swap the tokens.
 */
export const buildOrder = (params: {
  owner: Address;
  sellToken: Address;
  buyToken: Address;
  sellAmount: bigint;
  buyAmount: bigint;
  kind: OrderKind;
  now: number;
}): CowOrder => ({
  sellToken: params.sellToken,
  buyToken: params.buyToken,
  receiver: params.owner,
  sellAmount: params.sellAmount,
  buyAmount: params.buyAmount,
  validTo: params.now + ORDER_VALIDITY_SECONDS,
  appData: APP_DATA_HASH,
  feeAmount: 0n,
  kind: params.kind,
  partiallyFillable: false,
  sellTokenBalance: 'erc20',
  buyTokenBalance: 'erc20',
});

/** `orderDigest ‖ owner ‖ validTo`, as GPv2Settlement derives it. */
export const orderUid = (
  order: CowOrder,
  owner: Address,
  chainId: number,
  settlement: Address,
): Hex =>
  encodePacked(
    ['bytes32', 'address', 'uint32'],
    [
      hashTypedData({
        domain: orderDomain(chainId, settlement),
        types: ORDER_TYPES,
        primaryType: 'Order',
        message: order,
      }),
      owner,
      order.validTo,
    ],
  );

/**
 * BRZ to lock for a buy quote: the quote plus slippage headroom, plus a
 * reserve left behind for the paymaster's BRZ charge. Rounded up to the cent,
 * since the lock is also the Pix amount in R$.
 */
export const lockAmountFor = (quotedBrz: bigint, feeReserve: bigint) => {
  const cents = 10n ** 16n;
  const total = withHeadroom(quotedBrz) + feeReserve;
  return ((total + cents - 1n) / cents) * cents;
};

/** A quoted sell amount plus the slippage headroom an order may spend. */
export const withHeadroom = (quoted: bigint) =>
  (quoted * (10_000n + LOCK_SLIPPAGE_BPS)) / 10_000n;

/**
 * How much more BRZ per unit the real amount costs than a small reference
 * trade, in basis points. Uses quote amounts net of the network fee, which is
 * flat and would otherwise dominate the small reference.
 */
export const priceImpactBps = (
  real: { sellAmount: bigint; buyAmount: bigint },
  reference: { sellAmount: bigint; buyAmount: bigint },
) =>
  Number(
    (real.sellAmount * reference.buyAmount * 10_000n) /
      (reference.sellAmount * real.buyAmount),
  ) - 10_000;

/**
 * Approve exactly what the order may sell, then publish the order on-chain.
 * Batched after `release` in the same UserOperation.
 */
export const presignCalls = (
  contracts: SettlementContracts,
  order: CowOrder,
  uid: Hex,
): AaCall[] => [
  {
    to: order.sellToken,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [contracts.vaultRelayer, order.sellAmount],
    }),
  },
  {
    to: contracts.settlement,
    value: 0n,
    data: encodeFunctionData({
      abi: settlementAbi,
      functionName: 'setPreSignature',
      args: [uid, true],
    }),
  },
];

/** Withdraw the pre-signature and the relayer allowance. */
export const cancelPresignCalls = (
  contracts: SettlementContracts,
  sellToken: Address,
  uid: Hex,
): AaCall[] => [
  {
    to: contracts.settlement,
    value: 0n,
    data: encodeFunctionData({
      abi: settlementAbi,
      functionName: 'setPreSignature',
      args: [uid, false],
    }),
  },
  {
    to: sellToken,
    value: 0n,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [contracts.vaultRelayer, 0n],
    }),
  },
];

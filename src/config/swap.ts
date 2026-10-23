// Post-release swap through CoW Protocol: the buyer's own account trades the
// released BRZ for another token. P2Pix itself only ever moves BRZ.

import type { Address } from 'viem';

/** Decimals and the relayer are read on-chain, so a token is one line here. */
export type SwapToken = { symbol: string; name: string; address: Address };

/**
 * Per-chain CoW settings, set in `config/networks.ts`. Absence means the swap
 * is off on the chain and only BRZ is offered.
 */
export type SwapConfig = {
  /** Order book base URL, e.g. `https://api.cow.fi/arbitrum_one`. */
  apiUrl: string;
  settlement: Address;
  tokens: SwapToken[];
};

/** Headroom on the quoted BRZ so the order still fills after the minutes a Pix takes. */
export const LOCK_SLIPPAGE_BPS = 200n;

/** Slippage accepted by a re-quote, which sells the BRZ already in the account. */
export const REQUOTE_SLIPPAGE_BPS = 100n;

/** Price impact above this shows a warning; it never blocks the buyer. */
export const IMPACT_WARN_BPS = 100;

export const ORDER_VALIDITY_SECONDS = 30 * 60;

/** Order metadata; its keccak256 is the order's `appData` field. */
export const APP_DATA = '{"appCode":"p2pix","metadata":{},"version":"1.4.0"}';

import type { Address, Chain, ChainContract } from 'viem';
import type { AaConfig } from '@/config/aa';

export enum TokenEnum {
  BRZ = 'BRZ',
  // BRX = 'BRX'
}

export type NetworkConfig = Chain & {
  tokens: Record<TokenEnum, ChainContract>;
  subgraphUrls: string[];
  /**
   * Per-chain AA settings (Kernel / Pimlico / passkey). Present only on chains
   * whose P2Pix deployment supports the AA rail. Absence means AA is disabled for this chain.
   */
  aa?: AaConfig;
  /** Post-release CoW swap. Absence means only BRZ is offered on this chain. */
  swap?: SwapConfig;
};

/** Decimals and the relayer are read on-chain, so a token is one line in `networks.ts`. */
export type SwapToken = { symbol: string; name: string; address: Address };

export type SwapConfig = {
  /** Order book base URL, e.g. `https://api.cow.fi/arbitrum_one`. */
  apiUrl: string;
  settlement: Address;
  tokens: SwapToken[];
};

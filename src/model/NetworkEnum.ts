import type { Chain, ChainContract } from 'viem';
import type { AaConfig } from '@/config/aa';
import type { SwapConfig } from '@/config/swap';

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

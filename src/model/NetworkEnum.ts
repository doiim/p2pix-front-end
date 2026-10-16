import type { Chain, ChainContract } from 'viem';
import type { AaConfig } from '@/config/aa';

export enum TokenEnum {
  BRZ = 'BRZ',
  // BRX = 'BRX'
}

/** The chain's native coin, as opposed to a configured ERC-20 (`TokenEnum`). */
export const NATIVE_TOKEN = 'native' as const;

/** Any token the send flow can move: a configured ERC-20 or the native coin. */
export type SendToken = TokenEnum | typeof NATIVE_TOKEN;

export type NetworkConfig = Chain & {
  tokens: Record<TokenEnum, ChainContract>;
  subgraphUrls: string[];
  /**
   * Per-chain AA settings (Kernel / Pimlico / passkey). Present only on chains
   * whose P2Pix deployment supports the AA rail. Absence means AA is disabled for this chain.
   */
  aa?: AaConfig;
};

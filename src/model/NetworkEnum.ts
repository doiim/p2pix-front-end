import type { Address, Chain } from 'viem';
import type { AaConfig } from '@/config/aa';

export enum TokenEnum {
  BRZ = 'BRZ',
  USDT = 'USDT',
  USDC = 'USDC',
  cbBTC = 'cbBTC',
  BRLA = 'BRLA',
  BRLV = 'BRLV',
}

export type TokenConfig = { address: Address; decimals: number };

export type NetworkConfig = Chain & {
  /**
   * BRZ is on every network: the paymaster charges every fee in it. Any other
   * token is usable on a network only once its address is listed here.
   */
  tokens: Record<TokenEnum.BRZ, TokenConfig> &
    Partial<Record<TokenEnum, TokenConfig>>;
  subgraphUrls: string[];
  /**
   * Per-chain AA settings (Kernel / Pimlico / passkey). Present only on chains
   * whose P2Pix deployment supports the AA rail. Absence means AA is disabled for this chain.
   */
  aa?: AaConfig;
};

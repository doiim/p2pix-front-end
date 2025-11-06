import type { Chain, ChainContract } from "viem";

export enum TokenEnum {
  BRZ = 'BRZ',
  // BRX = 'BRX'
}
export type NetworkConfig = Chain & {
  tokens: Record<TokenEnum, ChainContract>,
  subgraphUrls: string[]
};

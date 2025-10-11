import { Networks } from "@/config/networks"
import type { Chain, ChainContract } from "viem";

export type NetworkEnum = keyof typeof Networks;

export enum TokenEnum {
  BRZ = 'BRZ',
  // BRX = 'BRX'
}
export type NetworkConfig = Chain & {
  tokens: Record<TokenEnum, ChainContract>,
  subgraphUrls: string[]
};

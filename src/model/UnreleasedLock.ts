import { Address } from 'viem';
import type { TokenEnum } from './NetworkEnum';

export type UnreleasedLock = {
  lockID: bigint;
  sellerAddress: Address;
  token: TokenEnum;
  tokenAddress: Address;
  amount: number;
};

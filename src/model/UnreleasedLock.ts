import { Address } from 'viem';

export type UnreleasedLock = {
  lockID: bigint;
  sellerAddress: Address;
  tokenAddress: Address;
  amount: number;
  /** In the contract's own block count (`block.number` on its chain). */
  expirationBlock: bigint;
};

import { Address } from "viem";

export type UnreleasedLock = {
  lockID: bigint;
  sellerAddress: Address;
  tokenAddress: Address;
  amount: number;
};

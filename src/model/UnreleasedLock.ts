import { Address } from "viem";

export type UnreleasedLock = {
  lockID: string;
  sellerAddress?: Address;
  tokenAddress: Address;
  amount: number;
};

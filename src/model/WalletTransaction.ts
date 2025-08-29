import type { LockStatus } from "@/model/LockStatus";
import type { Address } from "viem";

export type WalletTransaction = {
  token?: Address;
  blockNumber: number;
  amount: number;
  seller: string;
  buyer: string;
  event: string;
  lockStatus?: LockStatus;
  transactionHash: string;
  transactionID?: string;
};

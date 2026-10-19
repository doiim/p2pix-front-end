import type { LockStatus } from '@/model/LockStatus';
import type { TokenEnum } from '@/model/NetworkEnum';

export type WalletTransaction = {
  token: TokenEnum;
  blockNumber: number;
  blockTimestamp?: number;
  amount: number;
  seller: string;
  buyer: string;
  event: string;
  lockStatus?: LockStatus;
  transactionHash: string;
  transactionID?: string;
};

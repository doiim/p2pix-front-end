import type { TokenEnum } from './NetworkEnum';

export type AccountBalance = {
  /** Absent for the network's native coin. */
  token?: TokenEnum;
  symbol: string;
  image: string;
  amount: bigint;
  decimals: number;
};

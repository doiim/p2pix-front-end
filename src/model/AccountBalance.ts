import type { TokenEnum } from './NetworkEnum';

export type AccountBalance = {
  /** `null` is the network's native coin. */
  token: TokenEnum | null;
  symbol: string;
  image: string;
  amount: bigint;
  decimals: number;
};

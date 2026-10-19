import type { Address } from 'viem';

export type AccountBalance = {
  /** `null` is the network's native coin. */
  address: Address | null;
  symbol: string;
  image: string;
  amount: bigint;
  decimals: number;
};

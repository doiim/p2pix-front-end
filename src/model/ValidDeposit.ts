import type { Address } from 'viem';
import type { NetworkConfig } from '@/model/NetworkEnum';

export type ValidDeposit = {
  token: Address;
  blockNumber: number;
  remaining: number;
  seller: Address;
  network: NetworkConfig;
  open?: boolean;
};

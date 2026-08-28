import type { Address, Hex, PublicClient, WalletClient } from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import type { SmartAccountClient } from 'permissionless';
import type { PimlicoClient } from 'permissionless/clients/pimlico';

import type { NetworkConfig } from '@/model/NetworkEnum';

export type AaCall = { to: Address; data: Hex; value?: bigint };

export type AaOwnerKind = 'passkey' | 'reown';

export type AaContext = {
  account: SmartAccount;
  sponsoredClient: SmartAccountClient;
  /** Paid operations that must already have a real ERC-20 balance. */
  erc20Client: SmartAccountClient;
  ownerKind: AaOwnerKind;
  network: NetworkConfig;
  pimlicoClient: PimlicoClient;
};

export type AaRuntime = {
  connectorId?: string;
  publicClient: PublicClient;
  walletClient?: WalletClient | null;
  network: NetworkConfig;
};

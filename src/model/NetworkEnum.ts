import type { Address, Chain, ChainContract } from 'viem';

export enum TokenEnum {
  BRZ = 'BRZ',
  // BRX = 'BRX'
}

export type OperationPaymasterPolicies = {
  /** Verifying-paymaster policy reserved for an authorized first lock. */
  firstLock?: { sponsorshipPolicyId: string };
  /** ERC-20 paymaster used by release and subsequent paid operations. */
  paidOperations?: { token: Address };
};

export type AaNetworkConfig = {
  /** Optional chain-specific override. Pimlico's URL is derived from its API key otherwise. */
  bundlerUrl?: string;
  paymasterPolicies: OperationPaymasterPolicies;
  /** @deprecated Compatibility projection for the existing fee-preview helper. */
  paymasterPolicy?: { type: 'erc20'; token: Address };
};

export type NetworkConfig = Chain & {
  tokens: Record<TokenEnum, ChainContract>;
  subgraphUrls: string[];
  /** Present only when the P2Pix deployment on this chain supports the Kernel AA rail. */
  aa?: AaNetworkConfig;
};

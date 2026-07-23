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
  /**
   * How the first-lock sponsorship decision is made:
   * - `caps-only` (default): backendless — the client sponsors a p2pix lock only
   *   when the account cannot pay the fee token itself; abuse is bounded by the
   *   Pimlico policy caps. No `/aa/first-lock-authorization` call.
   * - `backend`: the authoritative `/aa/first-lock-authorization` endpoint + a
   *   Pimlico sponsorship webhook gate each sponsored lock (one per identity).
   */
  sponsorshipMode?: 'caps-only' | 'backend';
  /** Local Anvil + Alto rail: no paymaster, account balance is dev-funded. */
  localSelfFunded?: boolean;
};

export type NetworkConfig = Chain & {
  tokens: Record<TokenEnum, ChainContract>;
  subgraphUrls: string[];
  /** Present only when the P2Pix deployment on this chain supports the Kernel AA rail. */
  aa?: AaNetworkConfig;
};

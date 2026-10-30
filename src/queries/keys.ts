import type { Address } from 'viem';

/**
 * Every key is `[family, ...params]`; mutations invalidate a whole family on
 * its prefix (`queryKey: queryKeyRoots.walletDeposits`). Builders exist only
 * where a key is built twice and both must match.
 */
export const queryKeyRoots = {
  activity: ['activity'],
  analytics: ['analytics'],
  networkDeposits: ['network-deposits'],
  walletDeposits: ['wallet-deposits'],
  walletTransactions: ['wallet-transactions'],
  sellerLockState: ['seller-lock-state'],
  unreleasedLock: ['unreleased-lock'],
  lock: ['lock'],
  participantId: ['participant-id'],
  aaAddress: ['aa-address'],
  passkeyBalances: ['passkey-balances'],
  passkeyPrices: ['passkey-prices'],
  backupPasskey: ['backup-passkey'],
  solicitation: ['solicitation'],
  pixProof: ['pix-proof'],
} as const;

export const lockKey = (chainId: number, lockId: string) =>
  [...queryKeyRoots.lock, chainId, lockId] as const;
export const participantIdKey = (
  chainId: number,
  seller: Address,
  token: Address,
) => [...queryKeyRoots.participantId, chainId, seller, token] as const;
export const activityKey = (chainId: number, address: string | null) =>
  [...queryKeyRoots.activity, chainId, address ?? 'all'] as const;

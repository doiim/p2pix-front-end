import { useMutation } from '@tanstack/vue-query';
import type { Address } from 'viem';

import {
  addLock,
  releaseLock,
  withdrawDeposit,
} from '@/blockchain/buyerMethods';
import type { PixProof } from '@/utils/pixProof';
import { addDeposit } from '@/blockchain/sellerMethods';
import { getExpiredLockIds, sweepExpiredLocks } from '@/blockchain/wallet';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { queryClient } from './client';
import { queryKeyRoots } from './keys';

/**
 * A write changes what the subgraph and the contract report, so the affected
 * read families are invalidated instead of each caller remembering to refetch.
 */
const invalidateDeposits = () => {
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.walletDeposits,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.networkDeposits,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.walletTransactions,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.sellerLockState,
  });
};

export const invalidateLocks = () => {
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.unreleasedLock,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.walletTransactions,
  });
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.sellerLockState,
  });
  // A release resolves a lock, which `useLockQuery` (QR / redirect) and the
  // `/:lockID` fetchQuery in HomeView read straight from its id.
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.lock,
  });
  // `addLock` reduces the seller's on-chain balance, so the buy form's
  // deposit list must not keep showing pre-lock balances.
  void queryClient.invalidateQueries({
    queryKey: queryKeyRoots.networkDeposits,
  });
};

/** Reserve a deposit: the counterpart of the buyer's `addLock`. */
export const useAddDepositMutation = () => {
  return useMutation({
    mutationFn: () => addDeposit(),
    onSuccess: () => invalidateDeposits(),
  });
};

export const useAddLockMutation = () => {
  return useMutation({
    mutationFn: (args: {
      sellerAddress: Address;
      tokenAddress: Address;
      amount: number;
      skipAllowlist?: boolean;
    }) =>
      addLock(
        args.sellerAddress,
        args.tokenAddress,
        args.amount,
        args.skipAllowlist,
      ),
    onSuccess: () => invalidateLocks(),
  });
};

export const useWithdrawDepositMutation = () => {
  return useMutation({
    mutationFn: async (args: {
      amount: string;
      token: Address;
      seller: Address;
      network: NetworkConfig;
    }) => {
      // `withdraw` runs `unlockExpired` on-chain, which reverts on any id that
      // is no longer expired. Re-reading at send time drops ids a stale
      // page-load snapshot still holds; a third-party sweep landing between
      // this read and the tx still reverts, and shows as a failed withdrawal.
      // A subgraph outage (`null`) sends `unlockExpired([])`, a no-op: freeing
      // the offer's balance must not depend on the subgraph. `sweepExpiredLocks`
      // fails on the same outage instead, since the expired list is its whole job.
      const expiredLocks =
        (await getExpiredLockIds(args.seller, args.network)) ?? [];
      return withdrawDeposit(args.amount, args.token, expiredLocks);
    },
    onSuccess: () => invalidateDeposits(),
  });
};

/** Return expired locks to the seller's available balance. */
export const useSweepExpiredLocksMutation = () => {
  return useMutation({
    mutationFn: (args: { seller: Address; network: NetworkConfig }) =>
      sweepExpiredLocks(args.seller, args.network),
    onSuccess: () => invalidateDeposits(),
  });
};

export const useReleaseLockMutation = () => {
  return useMutation({
    mutationFn: (args: { lockID: bigint; proof: PixProof }) =>
      releaseLock(args.lockID, args.proof),
    onSuccess: () => invalidateLocks(),
  });
};

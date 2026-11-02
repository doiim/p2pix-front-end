import { formatEther, isAddress, isAddressEqual, type Address } from 'viem';
import { getContract } from './provider';
import { p2PixAbi } from './abi';
import { getSender, sendContractCalls } from './send';
import { getValidDeposits, getUnreleasedLockById, p2pixOn } from './events';
import { toLock } from './buyerMethods';
import { isRecord, rowsOf } from '@/queries/graphql';
import { escapeForGraphQL } from '@/utils/escapeForGraphQL';

import type { ValidDeposit } from '@/model/ValidDeposit';
import type { WalletTransaction } from '@/model/WalletTransaction';
import type { UnreleasedLock } from '@/model/UnreleasedLock';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { LockStatus } from '@/model/LockStatus';

export const getWalletDeposits = async (
  walletAddress: Address,
  network: NetworkConfig,
  token: Address,
): Promise<ValidDeposit[]> => {
  const walletDeposits = await getValidDeposits(token, network);
  return walletDeposits
    .filter((deposit) => isAddressEqual(deposit.seller, walletAddress))
    .sort((a, b) => b.blockNumber - a.blockNumber);
};

// A lock id only means something with its chain: the subgraph rows come from
// `network`, so the status is read from that chain's P2Pix too. Reading the
// selected chain showed another chain's lock #N status after a network switch.
const readLockStatus = async (
  id: bigint,
  network: NetworkConfig,
): Promise<LockStatus> => {
  const { address, client } = p2pixOn(network);
  // getLocksStatus returns [locks, status]; we only need status
  const [, status] = await client.readContract({
    address,
    abi: p2PixAbi,
    functionName: 'getLocksStatus',
    args: [[id]],
  });
  return status[0];
};

// Field selections of the documents below; `rowsOf` checks every row against
// them. The lock query does not request `token` on `lockAddeds`.
const DEPOSIT_FIELDS = [
  'id',
  'seller',
  'token',
  'amount',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
] as const;
const LOCK_ADDED_FIELDS = [
  'id',
  'buyer',
  'lockID',
  'seller',
  'amount',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
] as const;
const LOCK_RELEASED_FIELDS = [
  'id',
  'buyer',
  'lockId',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
] as const;

const addressOf = (value: string): Address => {
  if (!isAddress(value)) throw new Error('Resposta inesperada do subgraph');
  return value;
};

const bigintOf = (value: string): bigint => {
  if (!/^\d+$/.test(value)) throw new Error('Resposta inesperada do subgraph');
  return BigInt(value);
};

export const getWalletTransactions = async (
  walletAddress: Address,
  network: NetworkConfig,
): Promise<WalletTransaction[]> => {
  const escapedAddress = escapeForGraphQL(walletAddress);

  // Query subgraph for all relevant transactions
  const subgraphQuery = {
    query: `
      {
        depositAddeds(where: {seller: "${escapedAddress}"}) {
          id
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
        lockAddeds(where: {buyer: "${escapedAddress}"}) {
          id
          buyer
          lockID
          seller
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
        lockReleaseds(where: {buyer: "${escapedAddress}"}) {
          id
          buyer
          lockId
          blockTimestamp
          blockNumber
          transactionHash
        }
        depositWithdrawns(where: {seller: "${escapedAddress}"}) {
          id
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
      }
    `,
  };

  // Same outage tolerance as the deposit list: an empty history instead of a
  // rejected refresh. A reachable subgraph answering with the wrong shape is
  // not an outage: `rowsOf` throws.
  const data = await fetch(network.subgraphUrls[0], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subgraphQuery),
  })
    .then(async (response): Promise<Record<string, unknown>> => {
      if (!response.ok) throw new Error(`Erro HTTP: status ${response.status}`);
      const body: unknown = await response.json();
      return isRecord(body) && isRecord(body.data) ? body.data : {};
    })
    .catch((error): Record<string, unknown> => {
      console.error('[wallet] could not read transactions', error);
      return {};
    });

  // Convert all transactions to common WalletTransaction format
  const transactions: WalletTransaction[] = [];

  // Process deposit added events
  for (const deposit of rowsOf(data, 'depositAddeds', DEPOSIT_FIELDS)) {
    transactions.push({
      id: deposit.id,
      token: addressOf(deposit.token),
      blockNumber: parseInt(deposit.blockNumber),
      blockTimestamp: parseInt(deposit.blockTimestamp),
      amount: parseFloat(formatEther(bigintOf(deposit.amount))),
      seller: deposit.seller,
      buyer: '',
      event: 'DepositAdded',
      lockStatus: undefined,
      transactionHash: deposit.transactionHash,
    });
  }

  // Process lock added events
  for (const lock of rowsOf(data, 'lockAddeds', LOCK_ADDED_FIELDS)) {
    // Get lock status from the contract
    const lockStatus = await readLockStatus(bigintOf(lock.lockID), network);

    transactions.push({
      id: lock.id,
      token: undefined,
      blockNumber: parseInt(lock.blockNumber),
      blockTimestamp: parseInt(lock.blockTimestamp),
      amount: parseFloat(formatEther(bigintOf(lock.amount))),
      seller: lock.seller,
      buyer: lock.buyer,
      event: 'LockAdded',
      lockStatus: lockStatus,
      transactionHash: lock.transactionHash,
      transactionID: lock.lockID,
    });
  }

  // Process lock released events
  for (const release of rowsOf(data, 'lockReleaseds', LOCK_RELEASED_FIELDS)) {
    transactions.push({
      id: release.id,
      token: undefined, // Subgraph doesn't provide token in this event, we could enhance this later
      blockNumber: parseInt(release.blockNumber),
      blockTimestamp: parseInt(release.blockTimestamp),
      amount: -1, // Amount not available in this event
      seller: '',
      buyer: release.buyer,
      event: 'LockReleased',
      lockStatus: undefined,
      transactionHash: release.transactionHash,
      transactionID: release.lockId,
    });
  }

  // Process deposit withdrawn events
  for (const withdrawal of rowsOf(data, 'depositWithdrawns', DEPOSIT_FIELDS)) {
    transactions.push({
      id: withdrawal.id,
      token: addressOf(withdrawal.token),
      blockNumber: parseInt(withdrawal.blockNumber),
      blockTimestamp: parseInt(withdrawal.blockTimestamp),
      amount: parseFloat(formatEther(bigintOf(withdrawal.amount))),
      seller: withdrawal.seller,
      buyer: '',
      event: 'DepositWithdrawn',
      lockStatus: undefined,
      transactionHash: withdrawal.transactionHash,
    });
  }

  // Sort transactions by block number (newest first)
  return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
};

/** Undefined when the subgraph could not answer: lock ids are unknown. */
const fetchLockIds = async (
  field: 'buyer' | 'seller',
  walletAddress: Address,
  network: NetworkConfig,
): Promise<bigint[] | undefined> => {
  const subgraphUrl = network.subgraphUrls[0];

  try {
    const response = await fetch(subgraphUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{
          lockAddeds(where: {${field}: "${escapeForGraphQL(walletAddress)}"}, orderBy: blockNumber, orderDirection: desc) {
            lockID
          }
        }`,
      }),
    });
    if (!response.ok) {
      throw new Error(`Subgraph returned ${response.status}`);
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.data)) return undefined;
    return rowsOf(body.data, 'lockAddeds', ['lockID']).map((lock) =>
      bigintOf(lock.lockID),
    );
  } catch {
    return undefined;
  }
};

const getLockStatuses = async (
  field: 'buyer' | 'seller',
  walletAddress: Address,
  network: NetworkConfig,
) => {
  // Ids come from `network`'s subgraph: read that chain, not the selected one.
  const { address, client } = p2pixOn(network);
  const abi = p2PixAbi;
  const lockIds = await fetchLockIds(field, walletAddress, network);
  // Undefined: the subgraph could not answer. Null: there are no locks.
  if (!lockIds) return undefined;
  if (!lockIds.length) return null;

  const [sortedIDs, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [lockIds],
  });

  return { address, abi, client, sortedIDs, status };
};

export const checkUnreleasedLock = async (
  walletAddress: Address,
  network: NetworkConfig,
): Promise<UnreleasedLock | null> => {
  const locks = await getLockStatuses('buyer', walletAddress, network);
  if (!locks) return null;

  const { sortedIDs, status } = locks;
  const unreleasedLockId = status.findIndex(
    (s: LockStatus) => s === LockStatus.Active,
  );
  if (unreleasedLockId !== -1) {
    return getUnreleasedLockById(sortedIDs[unreleasedLockId], network);
  }
  return null;
};

const expiredOf = (
  sortedIDs: readonly bigint[],
  status: readonly LockStatus[],
): bigint[] => sortedIDs.filter((_, i) => status[i] === LockStatus.Expired);

/** Undefined when the subgraph could not answer: expired locks are unknown. */
export const getExpiredLockIds = async (
  seller: Address,
  network: NetworkConfig,
): Promise<bigint[] | undefined> => {
  const locks = await getLockStatuses('seller', seller, network);
  if (locks === undefined) return undefined;
  if (!locks) return [];

  return expiredOf(locks.sortedIDs, locks.status);
};

/** One subgraph + `getLocksStatus` read for both seller lock figures. */
export const getSellerLockState = async (
  seller: Address,
  network: NetworkConfig,
): Promise<{ activeLockAmount: number; expiredLockIds: bigint[] }> => {
  const locks = await getLockStatuses('seller', seller, network);
  if (!locks) return { activeLockAmount: 0, expiredLockIds: [] };

  const { address, abi, client, sortedIDs, status } = locks;
  const mapLocksResults = await client.multicall({
    contracts: sortedIDs.map((id) => ({
      address,
      abi,
      functionName: 'mapLocks' as const,
      args: [id],
    })),
  });

  const activeLockAmount = mapLocksResults.reduce((total, lock, index) => {
    if (status[index] === LockStatus.Active && lock.status === 'success') {
      const { amount } = toLock(lock.result);
      return total + Number(formatEther(amount));
    }
    return total;
  }, 0);

  return {
    activeLockAmount,
    expiredLockIds: expiredOf(sortedIDs, status),
  };
};

export const sweepExpiredLocks = async (
  seller: Address,
  network: NetworkConfig,
): Promise<number> => {
  const sender = await getSender();
  const lockIds = await getExpiredLockIds(seller, network);
  // An outage must show as a failed sweep, not as "already recovered".
  if (!lockIds) throw new Error('Subgraph unavailable: expired locks unknown');
  if (!lockIds.length) return 0;

  const { address, abi } = await getContract();
  // Moves no tokens out of the account, so there is no outflow to quote.
  const { success, receipt } = await sendContractCalls(sender, [
    { address, abi, functionName: 'unlockExpired', args: [lockIds] },
  ]);
  if (!success) {
    throw new Error(`Transaction failed: ${receipt.transactionHash}`);
  }
  return lockIds.length;
};

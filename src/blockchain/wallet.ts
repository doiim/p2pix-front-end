import {
  encodeFunctionData,
  formatEther,
  isAddressEqual,
  type Abi,
  type Address,
} from 'viem';
import { useUser } from '@/composables/useUser';
import {
  getActiveAaContext,
  getEffectiveWalletAddress,
  sendAaOperation,
} from './aa/operations';
import type { AaCall } from './aa/types';

import { getCurrentAccount, getPublicClient, getContract } from './provider';

import { getValidDeposits, getUnreleasedLockById } from './events';
import { toLock } from './buyerMethods';
import { escapeForGraphQL } from '@/utils/escapeForGraphQL';

import type { ValidDeposit } from '@/model/ValidDeposit';
import type { WalletTransaction } from '@/model/WalletTransaction';
import type { UnreleasedLock } from '@/model/UnreleasedLock';
import { LockStatus } from '@/model/LockStatus';

export const updateWalletStatus = async (): Promise<void> => {
  const user = useUser();
  const { address: connectorAddress } = getCurrentAccount();

  if (!connectorAddress) {
    return;
  }

  // The smart account is what signs locks and releases. Falling back to the
  // connector EOA here would show an address the app never transacts from, so
  // clear the state and surface the failure instead of downgrading silently.
  let address: Address;
  try {
    address = await getEffectiveWalletAddress(connectorAddress);
  } catch (cause) {
    user.setWalletAddress(null);
    user.setBalance('0');
    throw new Error('Could not resolve the smart account address', { cause });
  }

  const publicClient = getPublicClient();
  const balance = await publicClient.getBalance({ address });

  user.setWalletAddress(address);
  user.setBalance(formatEther(balance));
};

export const listValidDepositTransactionsByWalletAddress = async (
  walletAddress: Address,
): Promise<ValidDeposit[]> => {
  const user = useUser();
  // Wallet views render their own lists; keep them usable when the subgraph
  // or RPC is down instead of leaving their loading state stuck.
  const walletDeposits = await getValidDeposits(
    user.network.value.tokens[user.selectedToken.value].address,
    user.network.value,
  ).catch((error) => {
    console.error('[wallet] could not read deposits', error);
    return [];
  });
  if (walletDeposits) {
    return walletDeposits
      .filter((deposit) => isAddressEqual(deposit.seller, walletAddress))
      .sort((a: ValidDeposit, b: ValidDeposit) => {
        return b.blockNumber - a.blockNumber;
      });
  }

  return [];
};

const readLockStatus = async (id: bigint): Promise<LockStatus> => {
  const { address, abi, client } = await getContract();
  // getLocksStatus returns [locks, status]; we only need status
  const [, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [[id]],
  });
  return status[0];
};

export const listAllTransactionByWalletAddress = async (
  walletAddress: Address,
): Promise<WalletTransaction[]> => {
  const user = useUser();

  // Get the current network for the subgraph URL
  const network = user.network.value;

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
          buyer
          lockID
          seller
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
        lockReleaseds(where: {buyer: "${escapedAddress}"}) {
          buyer
          lockId
          blockTimestamp
          blockNumber
          transactionHash
        }
        depositWithdrawns(where: {seller: "${escapedAddress}"}) {
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
  // rejected refresh.
  const data = await fetch(network.subgraphUrls[0], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subgraphQuery),
  })
    .then((response) => response.json())
    .catch((error) => {
      console.error('[wallet] could not read transactions', error);
      return {};
    });
  // Convert all transactions to common WalletTransaction format
  const transactions: WalletTransaction[] = [];

  // Process deposit added events
  if (data.data?.depositAddeds) {
    for (const deposit of data.data.depositAddeds) {
      transactions.push({
        token: deposit.token,
        blockNumber: parseInt(deposit.blockNumber),
        blockTimestamp: parseInt(deposit.blockTimestamp),
        amount: parseFloat(formatEther(BigInt(deposit.amount))),
        seller: deposit.seller,
        buyer: '',
        event: 'DepositAdded',
        lockStatus: undefined,
        transactionHash: deposit.transactionHash,
      });
    }
  }

  // Process lock added events
  if (data.data?.lockAddeds) {
    for (const lock of data.data.lockAddeds) {
      // Get lock status from the contract
      const lockStatus = await readLockStatus(BigInt(lock.lockID));

      transactions.push({
        token: lock.token,
        blockNumber: parseInt(lock.blockNumber),
        blockTimestamp: parseInt(lock.blockTimestamp),
        amount: parseFloat(formatEther(BigInt(lock.amount))),
        seller: lock.seller,
        buyer: lock.buyer,
        event: 'LockAdded',
        lockStatus: lockStatus,
        transactionHash: lock.transactionHash,
        transactionID: lock.lockID.toString(),
      });
    }
  }

  // Process lock released events
  if (data.data?.lockReleaseds) {
    for (const release of data.data.lockReleaseds) {
      transactions.push({
        token: undefined, // Subgraph doesn't provide token in this event, we could enhance this later
        blockNumber: parseInt(release.blockNumber),
        blockTimestamp: parseInt(release.blockTimestamp),
        amount: -1, // Amount not available in this event
        seller: '',
        buyer: release.buyer,
        event: 'LockReleased',
        lockStatus: undefined,
        transactionHash: release.transactionHash,
        transactionID: release.lockId.toString(),
      });
    }
  }

  // Process deposit withdrawn events
  if (data.data?.depositWithdrawns) {
    for (const withdrawal of data.data.depositWithdrawns) {
      transactions.push({
        token: withdrawal.token,
        blockNumber: parseInt(withdrawal.blockNumber),
        blockTimestamp: parseInt(withdrawal.blockTimestamp),
        amount: parseFloat(formatEther(BigInt(withdrawal.amount))),
        seller: withdrawal.seller,
        buyer: '',
        event: 'DepositWithdrawn',
        lockStatus: undefined,
        transactionHash: withdrawal.transactionHash,
      });
    }
  }

  // Sort transactions by block number (newest first)
  return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
};

type LockAddedFromSubgraph = {
  lockID: string;
};

type LockAddedResponse = {
  data?: {
    lockAddeds?: LockAddedFromSubgraph[];
  };
};

/** Undefined when the subgraph could not answer: lock ids are unknown. */
const fetchLockIds = async (
  field: 'buyer' | 'seller',
  walletAddress: Address,
): Promise<bigint[] | undefined> => {
  const subgraphUrl = useUser().network.value.subgraphUrls[0];

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
    const data = (await response.json()) as LockAddedResponse;
    return data.data?.lockAddeds?.map((lock) => BigInt(lock.lockID));
  } catch {
    return undefined;
  }
};

const getLockStatuses = async (
  field: 'buyer' | 'seller',
  walletAddress: Address,
  onlyRpcProvider = true,
) => {
  const { address, abi, client } = await getContract(onlyRpcProvider);
  const lockIds = await fetchLockIds(field, walletAddress);
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
): Promise<UnreleasedLock | undefined> => {
  const locks = await getLockStatuses('buyer', walletAddress, false);
  if (!locks) return undefined;

  const { sortedIDs, status } = locks;
  const unreleasedLockId = status.findIndex(
    (s: LockStatus) => s === LockStatus.Active,
  );
  if (unreleasedLockId !== -1) {
    return getUnreleasedLockById(sortedIDs[unreleasedLockId]);
  }
};

const expiredOf = (
  sortedIDs: readonly bigint[],
  status: readonly LockStatus[],
): bigint[] => sortedIDs.filter((_, i) => status[i] === LockStatus.Expired);

/** Undefined when the subgraph could not answer: expired locks are unknown. */
export const getExpiredLockIds = async (
  seller: Address,
): Promise<bigint[] | undefined> => {
  const locks = await getLockStatuses('seller', seller);
  if (locks === undefined) return undefined;
  if (!locks) return [];

  return expiredOf(locks.sortedIDs, locks.status);
};

/** One subgraph + `getLocksStatus` read for both seller lock figures. */
export const getSellerLockState = async (
  seller: Address,
): Promise<{ activeLockAmount: number; expiredLockIds: bigint[] }> => {
  const locks = await getLockStatuses('seller', seller);
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
  token: Address,
): Promise<number> => {
  const lockIds = await getExpiredLockIds(seller);
  // An outage must show as a failed sweep, not as "already recovered".
  if (!lockIds) throw new Error('Subgraph unavailable: expired locks unknown');
  if (!lockIds.length) return 0;

  const { address, abi, client, wallet, account } = await getContract();
  const aa = await getActiveAaContext();

  if (aa) {
    const call: AaCall = {
      to: address,
      value: 0n,
      data: encodeFunctionData({
        abi: abi as Abi,
        functionName: 'unlockExpired',
        args: [lockIds],
      }),
    };
    const aaReceipt = await sendAaOperation(aa, [call], token);
    if (!aaReceipt.success) {
      throw new Error(
        `AA unlockExpired failed: ${aaReceipt.receipt.transactionHash}`,
      );
    }
    return lockIds.length;
  }

  if (!wallet) throw new Error('Wallet not connected');
  if (!account) throw new Error('Account not available');

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'unlockExpired',
    args: [lockIds],
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${receipt.transactionHash}`);
  }
  return lockIds.length;
};

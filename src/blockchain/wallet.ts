import { formatEther, type Address } from 'viem';
import { useUser } from '@/composables/useUser';
import { getEffectiveWalletAddress } from './aa/operations';

import { getCurrentAccount, getPublicClient, getContract } from './provider';

import { getValidDeposits, getUnreleasedLockById } from './events';
import { toLock } from './buyerMethods';

import type { ValidDeposit } from '@/model/ValidDeposit';
import type { WalletTransaction } from '@/model/WalletTransaction';
import type { UnreleasedLock } from '@/model/UnreleasedLock';
import { LockStatus } from '@/model/LockStatus';

// Addresses today come from viem/wagmi and are well-formed hex, but the
// GraphQL builders below interpolate them straight into a quoted literal, so
// any future caller passing an unvalidated string could break out of the
// literal and rewrite the query. Escape the only character that ends the
// literal; behavior for well-formed addresses is unchanged.
const escapeForGraphQL = (address: Address): string =>
  address.toLowerCase().replace(/"/g, '\\"');

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
  const walletDeposits = await getValidDeposits(
    user.network.value.tokens[user.selectedToken.value].address,
    user.network.value,
  );
  if (walletDeposits) {
    return walletDeposits
      .filter((deposit) => deposit.seller == walletAddress)
      .sort((a: ValidDeposit, b: ValidDeposit) => {
        return b.blockNumber - a.blockNumber;
      });
  }

  return [];
};

const getLockStatus = async (id: bigint): Promise<LockStatus> => {
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

  const response = await fetch(network.subgraphUrls[0], {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subgraphQuery),
  });

  const data = await response.json();
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
      const lockStatus = await getLockStatus(BigInt(lock.lockID));

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

const fetchLockIds = async (
  field: 'buyer' | 'seller',
  walletAddress: Address,
): Promise<bigint[]> => {
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
    return (data.data?.lockAddeds ?? []).map((lock) => BigInt(lock.lockID));
  } catch {
    return [];
  }
};

export const checkUnreleasedLock = async (
  walletAddress: Address,
): Promise<UnreleasedLock | undefined> => {
  const { address, abi, client } = await getContract();
  const lockIds = await fetchLockIds('buyer', walletAddress);
  if (!lockIds.length) return undefined;

  const [sortedIDs, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [lockIds],
  });

  const unreleasedLockId = status.findIndex(
    (s: LockStatus) => s === LockStatus.Active,
  );
  if (unreleasedLockId !== -1) {
    return getUnreleasedLockById(sortedIDs[unreleasedLockId]);
  }
};

export const getActiveLockAmount = async (
  walletAddress: Address,
): Promise<number> => {
  const { address, abi, client } = await getContract(true);
  const lockIds = await fetchLockIds('seller', walletAddress);
  if (!lockIds.length) return 0;

  const [sortedIDs, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [lockIds],
  });

  const mapLocksResults = await client.multicall({
    contracts: sortedIDs.map((id) => ({
      address,
      abi,
      functionName: 'mapLocks' as const,
      args: [id],
    })),
  });

  return mapLocksResults.reduce((total, lock, index) => {
    if (status[index] === LockStatus.Active && lock.status === 'success') {
      const { amount } = toLock(lock.result);
      return total + Number(formatEther(amount));
    }
    return total;
  }, 0);
};

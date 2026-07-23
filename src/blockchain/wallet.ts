import { formatEther, type Address } from 'viem';
import { getAccount } from '@wagmi/core';
import { getWagmiConfig } from '@/config/appkit';
import { useUser } from '@/composables/useUser';
import { getEffectiveWalletAddress } from './aaAccount';

import { getPublicClient, getContract } from './provider';

import { getValidDeposits, getUnreleasedLockById } from './events';

import type { ValidDeposit } from '@/model/ValidDeposit';
import type { WalletTransaction } from '@/model/WalletTransaction';
import type { UnreleasedLock } from '@/model/UnreleasedLock';
import { LockStatus } from '@/model/LockStatus';

// Single subgraph fetch helper. Posts the GraphQL query, returns the
// `data` payload (or null on network/parse failure with a console error).
// Centralises the 4 near-identical fetch+parse blocks that used to live
// inline in each list*Transaction function below.
export const fetchSubgraph = async <T>(
  url: string,
  query: string,
): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json = await response.json();
    return (json.data ?? null) as T | null;
  } catch (error) {
    console.error('subgraph fetch failed', error);
    return null;
  }
};

export const updateWalletStatus = async (): Promise<void> => {
  const user = useUser();
  const { address: connectorAddress } = getAccount(getWagmiConfig());

  if (!connectorAddress) {
    return;
  }

  const address = await getEffectiveWalletAddress(connectorAddress);
  if (!address) return;

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
  const [_sortedIDs, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [[id]],
  });
  return status[0];
};

// ---------------------------------------------------------------------------
// Subgraph response shapes
// ---------------------------------------------------------------------------

type AllTxResponse = {
  depositAddeds?: Array<{
    token: string;
    blockNumber: string;
    blockTimestamp: string;
    amount: string;
    seller: string;
    transactionHash: string;
  }>;
  lockAddeds?: Array<{
    token?: string;
    blockNumber: string;
    blockTimestamp: string;
    amount: string;
    seller: string;
    buyer: string;
    lockID: string;
    transactionHash: string;
  }>;
  lockReleaseds?: Array<{
    blockNumber: string;
    blockTimestamp: string;
    buyer: string;
    lockId: string;
    transactionHash: string;
  }>;
  depositWithdrawns?: Array<{
    token: string;
    blockNumber: string;
    blockTimestamp: string;
    amount: string;
    seller: string;
    transactionHash: string;
  }>;
};

type LockAddedResponse = {
  lockAddeds?: Array<{
    buyer: string;
    lockID: string;
    seller: string;
    amount: string;
    blockTimestamp: string;
    blockNumber: string;
    transactionHash: string;
  }>;
};

export const listAllTransactionByWalletAddress = async (
  walletAddress: Address,
): Promise<WalletTransaction[]> => {
  const user = useUser();
  const network = user.network.value;
  const w = walletAddress.toLowerCase();

  const data = await fetchSubgraph<AllTxResponse>(
    network.subgraphUrls[0],
    `{
      depositAddeds(where: {seller: "${w}"}) {
        id seller token amount blockTimestamp blockNumber transactionHash
      }
      lockAddeds(where: {buyer: "${w}"}) {
        buyer lockID seller amount blockTimestamp blockNumber transactionHash
      }
      lockReleaseds(where: {buyer: "${w}"}) {
        buyer lockId blockTimestamp blockNumber transactionHash
      }
      depositWithdrawns(where: {seller: "${w}"}) {
        seller token amount blockTimestamp blockNumber transactionHash
      }
    }`,
  );
  if (!data) return [];

  const transactions: WalletTransaction[] = [];

  for (const d of data.depositAddeds ?? []) {
    transactions.push({
      token: d.token as Address,
      blockNumber: parseInt(d.blockNumber),
      blockTimestamp: parseInt(d.blockTimestamp),
      amount: parseFloat(formatEther(BigInt(d.amount))),
      seller: d.seller,
      buyer: '',
      event: 'DepositAdded',
      lockStatus: undefined,
      transactionHash: d.transactionHash,
    });
  }

  for (const l of data.lockAddeds ?? []) {
    transactions.push({
      token: l.token as Address | undefined,
      blockNumber: parseInt(l.blockNumber),
      blockTimestamp: parseInt(l.blockTimestamp),
      amount: parseFloat(formatEther(BigInt(l.amount))),
      seller: l.seller,
      buyer: l.buyer,
      event: 'LockAdded',
      lockStatus: await getLockStatus(BigInt(l.lockID)),
      transactionHash: l.transactionHash,
      transactionID: l.lockID.toString(),
    });
  }

  for (const r of data.lockReleaseds ?? []) {
    transactions.push({
      token: undefined,
      blockNumber: parseInt(r.blockNumber),
      blockTimestamp: parseInt(r.blockTimestamp),
      amount: -1,
      seller: '',
      buyer: r.buyer,
      event: 'LockReleased',
      lockStatus: undefined,
      transactionHash: r.transactionHash,
      transactionID: r.lockId.toString(),
    });
  }

  for (const wd of data.depositWithdrawns ?? []) {
    transactions.push({
      token: wd.token as Address,
      blockNumber: parseInt(wd.blockNumber),
      blockTimestamp: parseInt(wd.blockTimestamp),
      amount: parseFloat(formatEther(BigInt(wd.amount))),
      seller: wd.seller,
      buyer: '',
      event: 'DepositWithdrawn',
      lockStatus: undefined,
      transactionHash: wd.transactionHash,
    });
  }

  return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
};

const listLockTransactions = async (
  filterField: 'buyer' | 'seller',
  address: Address,
) => {
  const user = useUser();
  const network = user.network.value;

  const data = await fetchSubgraph<LockAddedResponse>(
    network.subgraphUrls[0],
    `{
      lockAddeds(where: {${filterField}: "${address.toLowerCase()}"}) {
        buyer lockID seller amount blockTimestamp blockNumber transactionHash
      }
    }`,
  );
  if (!data?.lockAddeds) return [];

  return data.lockAddeds
    .sort((a, b) => parseInt(b.blockNumber) - parseInt(a.blockNumber))
    .map((lock) => {
      try {
        return {
          eventName: 'LockAdded' as const,
          args: {
            buyer: lock.buyer,
            lockID: BigInt(lock.lockID),
            seller: lock.seller,
            token: undefined,
            amount: BigInt(lock.amount),
          },
          blockNumber: BigInt(lock.blockNumber),
          transactionHash: lock.transactionHash,
        };
      } catch (error) {
        console.error('Error processing subgraph data', error);
        return null;
      }
    })
    .filter((decoded) => decoded !== null);
};

const listLockTransactionByWalletAddress = (walletAddress: Address) =>
  listLockTransactions('buyer', walletAddress);

const listLockTransactionBySellerAddress = (sellerAddress: Address) =>
  listLockTransactions('seller', sellerAddress);

export const checkUnreleasedLock = async (
  walletAddress: Address,
): Promise<UnreleasedLock | undefined> => {
  const { address, abi, client } = await getContract();
  const addedLocks = await listLockTransactionByWalletAddress(walletAddress);

  if (!addedLocks.length) return undefined;

  const lockIds = addedLocks.map((lock) => lock.args.lockID);

  const [sortedIDs, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [lockIds],
  });

  const unreleasedLockId = status.findIndex(
    (status: LockStatus) => status == LockStatus.Active,
  );

  if (unreleasedLockId !== -1)
    return getUnreleasedLockById(sortedIDs[unreleasedLockId]);
};

export const getActiveLockAmount = async (
  walletAddress: Address,
): Promise<number> => {
  const { address, abi, client } = await getContract(true);
  const lockSeller = await listLockTransactionBySellerAddress(walletAddress);

  if (!lockSeller.length) return 0;

  const lockIds = lockSeller.map((lock) => lock.args.lockID);

  const [_sortedIDs, status] = await client.readContract({
    address,
    abi,
    functionName: 'getLocksStatus',
    args: [lockIds],
  });

  const mapLocksRequests = status.map((id: LockStatus) =>
    client.readContract({
      address: address,
      abi,
      functionName: 'mapLocks',
      args: [BigInt(id)],
    }),
  );

  const mapLocksResults = await client.multicall({
    contracts: mapLocksRequests as any,
  });

  return mapLocksResults.reduce((total: number, lock: any, index: number) => {
    if (status[index] === 1) {
      return total + Number(formatEther(lock.amount));
    }
    return total;
  }, 0);
};

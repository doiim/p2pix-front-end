import type { NetworkConfig } from '@/model/NetworkEnum';

export interface Transaction {
  id: string;
  type: 'deposit' | 'lock' | 'release' | 'return';
  timestamp: string;
  blockTimestamp: string;
  seller?: string;
  buyer?: string | null;
  amount: string;
  /** ERC-20 address; absent on lock, release and return events,
   * which do not carry one. */
  token?: string;
  /** Set on DepositWithdrawn rows, which share the 'deposit' type. */
  withdrawn?: true;
  blockNumber: string;
  transactionHash: string;
}

export interface AnalyticsData {
  totalVolume: string;
  totalTransactions: string;
  totalLocks: string;
  totalDeposits: string;
  totalReleases: string;
}

// The shapes below mirror the selections in the query documents at the bottom
// of this file. Every selected field is present in the response, so the
// processors read them directly; the single trust point is the cast of the
// parsed body in `executeQuery`.
type EventFields = {
  id: string;
  seller: string;
  token: string;
  amount: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
};

type LockAddedFields = EventFields & { buyer: string; lockID: string };

type LockReleasedFields = {
  id: string;
  buyer: string;
  lockId: string;
  amount: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
};

type LockReturnedFields = {
  id: string;
  buyer: string;
  lockId: string;
  blockNumber: string;
  blockTimestamp: string;
  transactionHash: string;
};

type ActivityResponse = {
  depositAddeds?: EventFields[];
  depositWithdrawns?: EventFields[];
  lockAddeds?: LockAddedFields[];
  lockReleaseds?: LockReleasedFields[];
  lockReturneds?: LockReturnedFields[];
};

type AnalyticsAmountFields = { amount: string; blockTimestamp: string };

type AnalyticsResponse = {
  depositAddeds?: AnalyticsAmountFields[];
  depositWithdrawns?: AnalyticsAmountFields[];
  lockAddeds?: AnalyticsAmountFields[];
  lockReleaseds?: AnalyticsAmountFields[];
  lockReturneds?: { blockTimestamp: string }[];
};

type GraphQLBody<T> = {
  data?: T;
  errors?: { message?: string }[];
};

const executeQuery = async <T>(
  url: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`Erro HTTP: status ${response.status}`);
  }

  const body = (await response.json()) as GraphQLBody<T>;

  if (body.errors) {
    throw new Error(body.errors[0]?.message || 'Falha ao buscar os dados');
  }

  // The document fixes the field selection; the server returns exactly the
  // requested shape or omits the data key.
  return (body.data ?? {}) as T;
};

const ALL_ACTIVITY_QUERY = `
  query GetAllActivity($first: Int = 50) {
    depositAddeds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      seller
      token
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    depositWithdrawns(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      seller
      token
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    lockAddeds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      buyer
      lockID
      seller
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    lockReleaseds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      buyer
      lockId
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    lockReturneds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      buyer
      lockId
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const USER_ACTIVITY_QUERY = `
  query GetUserActivity($userAddress: String!, $first: Int = 50) {
    depositAddeds(first: $first, where: { seller: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      seller
      token
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    depositWithdrawns(first: $first, where: { seller: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      seller
      token
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    lockAddeds(first: $first, where: { buyer: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      buyer
      lockID
      seller
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    lockReleaseds(first: $first, where: { buyer: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      buyer
      lockId
      amount
      blockNumber
      blockTimestamp
      transactionHash
    }
    lockReturneds(first: $first, where: { buyer: $userAddress }, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      buyer
      lockId
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const ANALYTICS_QUERY = `
  query GetAnalytics {
    depositAddeds(first: 1000) {
      amount
      blockTimestamp
    }
    depositWithdrawns(first: 1000) {
      amount
      blockTimestamp
    }
    lockAddeds(first: 1000) {
      amount
      blockTimestamp
    }
    lockReleaseds(first: 1000) {
      amount
      blockTimestamp
    }
    lockReturneds(first: 1000) {
      blockTimestamp
    }
  }
`;

const formatTimestamp = (timestamp: string): string => {
  const now = Date.now() / 1000;
  const diff = now - parseInt(timestamp);

  if (diff < 60) return 'Agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} minutos atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} horas atrás`;
  return `${Math.floor(diff / 86400)} dias atrás`;
};

const formatAmount = (amount: string): string => {
  const num = parseFloat(amount);
  if (num >= 1000000000000000) return `${(num / 1000000000000000).toFixed(1)}Q`;
  if (num >= 1000000000000) return `${(num / 1000000000000).toFixed(1)}T`;
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}B`;
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  if (num < 1) return num.toFixed(4);
  return num.toFixed(2);
};

const processActivityData = (data: ActivityResponse): Transaction[] => {
  const activities: Transaction[] = [
    ...(data.depositAddeds ?? []).map(
      (deposit): Transaction => ({
        id: deposit.id,
        blockNumber: deposit.blockNumber,
        blockTimestamp: deposit.blockTimestamp,
        transactionHash: deposit.transactionHash,
        type: 'deposit',
        seller: deposit.seller,
        buyer: undefined,
        amount: deposit.amount,
        token: deposit.token,
        timestamp: formatTimestamp(deposit.blockTimestamp),
      }),
    ),
    ...(data.depositWithdrawns ?? []).map(
      (withdrawal): Transaction => ({
        id: withdrawal.id,
        blockNumber: withdrawal.blockNumber,
        blockTimestamp: withdrawal.blockTimestamp,
        transactionHash: withdrawal.transactionHash,
        type: 'deposit', // Treat as deposit withdrawal
        withdrawn: true,
        seller: withdrawal.seller,
        buyer: undefined,
        amount: withdrawal.amount,
        token: withdrawal.token,
        timestamp: formatTimestamp(withdrawal.blockTimestamp),
      }),
    ),
    ...(data.lockAddeds ?? []).map(
      (lock): Transaction => ({
        id: lock.id,
        blockNumber: lock.blockNumber,
        blockTimestamp: lock.blockTimestamp,
        transactionHash: lock.transactionHash,
        type: 'lock',
        seller: lock.seller,
        buyer: lock.buyer,
        amount: lock.amount,
        token: lock.token,
        timestamp: formatTimestamp(lock.blockTimestamp),
      }),
    ),
    ...(data.lockReleaseds ?? []).map(
      (release): Transaction => ({
        id: release.id,
        blockNumber: release.blockNumber,
        blockTimestamp: release.blockTimestamp,
        transactionHash: release.transactionHash,
        type: 'release',
        seller: undefined, // Release doesn't have seller info
        buyer: release.buyer,
        amount: release.amount,
        token: undefined, // Subgraph doesn't provide token
        timestamp: formatTimestamp(release.blockTimestamp),
      }),
    ),
    ...(data.lockReturneds ?? []).map(
      (returnTx): Transaction => ({
        id: returnTx.id,
        blockNumber: returnTx.blockNumber,
        blockTimestamp: returnTx.blockTimestamp,
        transactionHash: returnTx.transactionHash,
        type: 'return',
        seller: undefined, // Return doesn't have seller info
        buyer: returnTx.buyer,
        amount: '0', // Return doesn't have amount
        token: undefined, // Subgraph doesn't provide token
        timestamp: formatTimestamp(returnTx.blockTimestamp),
      }),
    ),
  ];

  return activities.sort(
    (a, b) => parseInt(b.blockTimestamp) - parseInt(a.blockTimestamp),
  );
};

const processAnalyticsData = (data: AnalyticsResponse): AnalyticsData => {
  let totalVolume = 0;
  let totalTransactions = 0;
  let totalLocks = 0;
  let totalDeposits = 0;
  let totalReleases = 0;

  for (const deposit of data.depositAddeds ?? []) {
    totalVolume += parseFloat(deposit.amount);
    totalTransactions++;
    totalDeposits++;
  }

  for (const withdrawal of data.depositWithdrawns ?? []) {
    totalVolume += parseFloat(withdrawal.amount);
    totalTransactions++;
  }

  for (const lock of data.lockAddeds ?? []) {
    totalVolume += parseFloat(lock.amount);
    totalTransactions++;
    totalLocks++;
  }

  for (const release of data.lockReleaseds ?? []) {
    totalVolume += parseFloat(release.amount);
    totalTransactions++;
    totalReleases++;
  }

  totalTransactions += (data.lockReturneds ?? []).length;

  return {
    totalVolume: formatAmount(totalVolume.toString()),
    totalTransactions: totalTransactions.toString(),
    totalLocks: totalLocks.toString(),
    totalDeposits: totalDeposits.toString(),
    totalReleases: totalReleases.toString(),
  };
};

/** Fetch the explorer feed: every event, or one wallet's events when an
 * address is given. The address travels as a GraphQL variable, so the query
 * document is never rebuilt from user input. */
export const fetchActivity = async (
  network: NetworkConfig,
  address: string | null,
): Promise<Transaction[]> => {
  const url = network.subgraphUrls[0];
  const data = address
    ? await executeQuery<ActivityResponse>(url, USER_ACTIVITY_QUERY, {
        userAddress: address,
        first: 50,
      })
    : await executeQuery<ActivityResponse>(url, ALL_ACTIVITY_QUERY, {
        first: 50,
      });

  return processActivityData(data);
};

export const fetchAnalytics = async (
  network: NetworkConfig,
): Promise<AnalyticsData> => {
  const data = await executeQuery<AnalyticsResponse>(
    network.subgraphUrls[0],
    ANALYTICS_QUERY,
  );
  return processAnalyticsData(data);
};

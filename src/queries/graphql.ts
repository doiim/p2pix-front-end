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

// Field selections of the query documents below. The subgraph is a remote
// server: `rowsOf` checks each row against its selection before use, so a
// changed schema or a hostile endpoint fails loudly instead of feeding
// `undefined` into the explorer.
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
  'seller',
  'buyer',
  'lockID',
  'amount',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
] as const;
const LOCK_RELEASED_FIELDS = [
  'id',
  'buyer',
  'lockId',
  'amount',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
] as const;
const LOCK_RETURNED_FIELDS = [
  'id',
  'buyer',
  'lockId',
  'blockNumber',
  'blockTimestamp',
  'transactionHash',
] as const;
const AMOUNT_FIELDS = ['amount', 'blockTimestamp'] as const;

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

const hasFields =
  <F extends string>(fields: readonly F[]) =>
  (row: unknown): row is Record<F, string> =>
    isRecord(row) && fields.every((f) => typeof row[f] === 'string');

/** One collection of the response, every row checked against `fields`. */
const rowsOf = <F extends string>(
  data: Record<string, unknown>,
  collection: string,
  fields: readonly F[],
): Record<F, string>[] => {
  const rows = data[collection];
  if (rows === undefined || rows === null) return [];
  if (!Array.isArray(rows) || !rows.every(hasFields(fields))) {
    throw new Error(`Resposta inesperada do subgraph em ${collection}`);
  }
  return rows;
};

const executeQuery = async (
  url: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> => {
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

  const body: unknown = await response.json();
  if (!isRecord(body)) throw new Error('Resposta inesperada do subgraph');
  if (Array.isArray(body.errors) && body.errors.length > 0) {
    const first: unknown = body.errors[0];
    throw new Error(
      isRecord(first) && typeof first.message === 'string'
        ? first.message
        : 'Falha ao buscar os dados',
    );
  }
  return isRecord(body.data) ? body.data : {};
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

const processActivityData = (data: Record<string, unknown>): Transaction[] => {
  const activities: Transaction[] = [
    ...rowsOf(data, 'depositAddeds', DEPOSIT_FIELDS).map(
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
    ...rowsOf(data, 'depositWithdrawns', DEPOSIT_FIELDS).map(
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
    ...rowsOf(data, 'lockAddeds', LOCK_ADDED_FIELDS).map(
      (lock): Transaction => ({
        id: lock.id,
        blockNumber: lock.blockNumber,
        blockTimestamp: lock.blockTimestamp,
        transactionHash: lock.transactionHash,
        type: 'lock',
        seller: lock.seller,
        buyer: lock.buyer,
        amount: lock.amount,
        token: undefined, // the lockAddeds selection has no token
        timestamp: formatTimestamp(lock.blockTimestamp),
      }),
    ),
    ...rowsOf(data, 'lockReleaseds', LOCK_RELEASED_FIELDS).map(
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
    ...rowsOf(data, 'lockReturneds', LOCK_RETURNED_FIELDS).map(
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

const processAnalyticsData = (data: Record<string, unknown>): AnalyticsData => {
  let totalVolume = 0;
  let totalTransactions = 0;
  let totalLocks = 0;
  let totalDeposits = 0;
  let totalReleases = 0;

  for (const deposit of rowsOf(data, 'depositAddeds', AMOUNT_FIELDS)) {
    totalVolume += parseFloat(deposit.amount);
    totalTransactions++;
    totalDeposits++;
  }

  for (const withdrawal of rowsOf(data, 'depositWithdrawns', AMOUNT_FIELDS)) {
    totalVolume += parseFloat(withdrawal.amount);
    totalTransactions++;
  }

  for (const lock of rowsOf(data, 'lockAddeds', AMOUNT_FIELDS)) {
    totalVolume += parseFloat(lock.amount);
    totalTransactions++;
    totalLocks++;
  }

  for (const release of rowsOf(data, 'lockReleaseds', AMOUNT_FIELDS)) {
    totalVolume += parseFloat(release.amount);
    totalTransactions++;
    totalReleases++;
  }

  totalTransactions += rowsOf(data, 'lockReturneds', [
    'blockTimestamp',
  ] as const).length;

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
    ? await executeQuery(url, USER_ACTIVITY_QUERY, {
        userAddress: address,
        first: 50,
      })
    : await executeQuery(url, ALL_ACTIVITY_QUERY, {
        first: 50,
      });

  return processActivityData(data);
};

export const fetchAnalytics = async (
  network: NetworkConfig,
): Promise<AnalyticsData> => {
  const data = await executeQuery(network.subgraphUrls[0], ANALYTICS_QUERY);
  return processAnalyticsData(data);
};

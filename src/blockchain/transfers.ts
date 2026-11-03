import {
  erc20Abi,
  parseAbiItem,
  zeroAddress,
  type Address,
  type Hash,
} from 'viem';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { getPublicClient } from './provider';

export type TransferRow = {
  tokenSymbol: string;
  token: Address;
  direction: 'in' | 'out';
  amount: bigint;
  decimals: number;
  txHash: Hash;
  blockNumber: bigint;
  /** Milliseconds since epoch. */
  timestamp: number;
};

export type TransfersResult = { rows: TransferRow[]; partial: boolean };

const TRANSFER = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 value)',
);
const MIN_CHUNK = 10_000n;
const MAX_REQUESTS = 20;

const decimalsCache = new Map<string, number>();
const timestampCache = new Map<string, number>();

const lower = (a: string) => a.toLowerCase();

const p2pixAddress = (network: NetworkConfig): Address | undefined => {
  const entry = network.contracts?.p2pix;
  return entry && 'address' in entry ? entry.address : undefined;
};

type Client = ReturnType<typeof getPublicClient>;

async function decimalsOf(client: Client, chainId: number, token: Address) {
  const key = `${chainId}:${lower(token)}`;
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;
  const value = await client.readContract({
    address: token,
    abi: erc20Abi,
    functionName: 'decimals',
  });
  decimalsCache.set(key, value);
  return value;
}

async function timestampsOf(client: Client, chainId: number, blocks: bigint[]) {
  const missing = [...new Set(blocks)].filter(
    (b) => !timestampCache.has(`${chainId}:${b}`),
  );
  await Promise.all(
    missing.map(async (blockNumber) => {
      const block = await client.getBlock({ blockNumber });
      timestampCache.set(
        `${chainId}:${blockNumber}`,
        Number(block.timestamp) * 1000,
      );
    }),
  );
  return (b: bigint) => timestampCache.get(`${chainId}:${b}`) ?? 0;
}

/** Newest range first, so a budget cut-off loses the oldest history. */
async function collectLogs(
  client: Client,
  tokens: Address[],
  account: Address,
  latest: bigint,
  fromBlock: bigint,
) {
  const logs: Awaited<ReturnType<typeof fetchRange>>[] = [];
  const stack: [bigint, bigint][] = [[fromBlock, latest]];
  let requests = 0;
  let partial = false;
  while (stack.length) {
    const [from, to] = stack.pop()!;
    if (requests + 2 > MAX_REQUESTS) {
      partial = true;
      break;
    }
    requests += 2;
    try {
      logs.push(await fetchRange(client, tokens, account, from, to));
    } catch {
      if (to - from + 1n <= MIN_CHUNK) {
        partial = true;
        continue;
      }
      const mid = from + (to - from) / 2n;
      stack.push([from, mid], [mid + 1n, to]);
    }
  }
  return { logs: logs.flat(), partial };
}

async function fetchRange(
  client: Client,
  address: Address[],
  account: Address,
  fromBlock: bigint,
  toBlock: bigint,
) {
  const [incoming, outgoing] = await Promise.all([
    client.getLogs({
      address,
      event: TRANSFER,
      args: { to: account },
      fromBlock,
      toBlock,
    }),
    client.getLogs({
      address,
      event: TRANSFER,
      args: { from: account },
      fromBlock,
      toBlock,
    }),
  ]);
  return [...incoming, ...outgoing];
}

/**
 * ERC-20 transfers of every token the network knows, to or from `account`.
 * Never throws for RPC range/limit errors: returns what was read with `partial`.
 */
export async function readTokenTransfers(
  network: NetworkConfig,
  account: Address,
): Promise<TransfersResult> {
  const known = [
    ...Object.entries(network.tokens).map(([symbol, t]) => ({
      symbol,
      address: t.address,
    })),
    ...(network.swap?.tokens ?? []),
  ];
  const symbols = new Map(known.map((t) => [lower(t.address), t.symbol]));
  const client = getPublicClient(network.id);
  const skip = new Set(
    [p2pixAddress(network), zeroAddress]
      .filter((a): a is Address => Boolean(a))
      .map(lower),
  );
  // A CoW swap moves the sold token to the settlement contract and the bought
  // token back: show only what arrived, the subgraph already covers the sale.
  const settlement = network.swap?.settlement
    ? lower(network.swap.settlement)
    : null;

  const latest = await client.getBlockNumber();
  const { logs, partial } = await collectLogs(
    client,
    [...symbols.keys()] as Address[],
    account,
    latest,
    0n, // ponytail: no deploy block in config; add `blockCreated` when networks.ts has it
  );

  const me = lower(account);
  const seen = new Set<string>();
  const wanted = logs.filter((log) => {
    const { from, to } = log.args;
    const id = `${log.transactionHash}:${log.logIndex}`;
    if (!from || !to || seen.has(id)) return false;
    seen.add(id);
    const other = lower(lower(from) === me ? to : from);
    if (other === settlement) return lower(to) === me;
    return !skip.has(other) && lower(from) !== lower(to);
  });

  const stamp = await timestampsOf(
    client,
    network.id,
    wanted.map((l) => l.blockNumber),
  );
  // One token whose decimals() fails drops its rows (shown as partial), not the whole list.
  const settled = await Promise.all(
    wanted.map(async (log): Promise<TransferRow | null> => {
      const decimals = await decimalsOf(client, network.id, log.address).catch(
        (cause) => {
          console.error('[transfers] decimals unavailable', log.address, cause);
          return null;
        },
      );
      return decimals === null
        ? null
        : {
            tokenSymbol: symbols.get(lower(log.address)) ?? '',
            token: log.address,
            direction: lower(log.args.to ?? '') === me ? 'in' : 'out',
            amount: log.args.value ?? 0n,
            decimals,
            txHash: log.transactionHash,
            blockNumber: log.blockNumber,
            timestamp: stamp(log.blockNumber),
          };
    }),
  );
  const rows = settled.filter((row): row is TransferRow => row !== null);
  return { rows, partial: partial || rows.length < settled.length };
}

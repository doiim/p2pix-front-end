// ERC-20 transfers of every token the network knows, to or from `account`.
//
// The read is Alchemy's `alchemy_getAssetTransfers` on the network's own
// configured RPC. A plain `eth_getLogs` scan cannot do this job there: the
// free-tier endpoint caps `eth_getLogs` at a 10-block range, so a history scan
// only produced rejected requests on every poll. A non-Alchemy RPC answers
// "method not found" and the read then reports itself as partial and empty —
// the screen shows fewer rows, never an error.
import { isAddress, isHex, zeroAddress, type Address, type Hash } from 'viem';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { isRecord } from '@/queries/graphql';

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

const PAGE_SIZE = 0x3e8;
const MAX_PAGES = 3;

const lower = (a: string) => a.toLowerCase();

const p2pixAddress = (network: NetworkConfig): Address | undefined => {
  const entry = network.contracts?.p2pix;
  return entry && 'address' in entry ? entry.address : undefined;
};

/** One validated transfer: the raw amount, so no decimals() round trip. */
type RawTransfer = {
  id: string;
  from: Address;
  to: Address;
  token: Address;
  amount: bigint;
  decimals: number;
  txHash: Hash;
  blockNumber: bigint;
  /** Milliseconds since epoch. */
  timestamp: number;
};

/**
 * The RPC answers untrusted JSON: every field is checked before use and a
 * malformed row is dropped, never guessed at.
 */
const toTransfer = (raw: unknown): RawTransfer | null => {
  if (!isRecord(raw)) return null;
  const contract = raw.rawContract;
  if (!isRecord(contract)) return null;
  const stamp = isRecord(raw.metadata) ? raw.metadata.blockTimestamp : null;
  // A missing timestamp sorts the row oldest; a money field is never guessed.
  const timestamp = typeof stamp === 'string' ? Date.parse(stamp) || 0 : 0;
  const amount =
    typeof contract.value === 'string' && isHex(contract.value)
      ? BigInt(contract.value)
      : null;
  const decimals =
    typeof contract.decimal === 'string' && isHex(contract.decimal)
      ? Number(BigInt(contract.decimal))
      : NaN;
  if (amount === null || !Number.isInteger(decimals)) return null;
  if (typeof raw.from !== 'string' || !isAddress(raw.from)) return null;
  if (typeof raw.to !== 'string' || !isAddress(raw.to)) return null;
  if (typeof contract.address !== 'string' || !isAddress(contract.address))
    return null;
  if (typeof raw.hash !== 'string' || !isHex(raw.hash)) return null;
  if (typeof raw.blockNum !== 'string' || !isHex(raw.blockNum)) return null;
  return {
    id: typeof raw.uniqueId === 'string' ? raw.uniqueId : `${raw.hash}:raw`,
    from: raw.from,
    to: raw.to,
    token: contract.address,
    amount,
    decimals,
    txHash: raw.hash,
    blockNumber: BigInt(raw.blockNum),
    timestamp,
  };
};

/**
 * One direction of the account's history, newest first so a budget cut-off
 * loses the oldest transfers. A row the API shapes wrong is dropped.
 */
const sweep = async (
  rpcUrl: string,
  params: Record<string, unknown>,
): Promise<{ transfers: RawTransfer[]; partial: boolean }> => {
  const transfers: RawTransfer[] = [];
  let pageKey: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await fetch(rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: page,
        method: 'alchemy_getAssetTransfers',
        params: [{ ...params, ...(pageKey ? { pageKey } : {}) }],
      }),
    });
    if (!response.ok) throw new Error(`Transfers RPC: HTTP ${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.result))
      throw new Error('Transfers RPC: unexpected answer');
    const batch = Array.isArray(body.result.transfers)
      ? body.result.transfers
          .map(toTransfer)
          .filter((t): t is RawTransfer => t !== null)
      : [];
    transfers.push(...batch);
    pageKey =
      typeof body.result.pageKey === 'string' ? body.result.pageKey : undefined;
    if (!pageKey) return { transfers, partial: false };
  }
  // The sweep ended on a pageKey: transfers older than this are missing.
  return { transfers, partial: true };
};

/**
 * ERC-20 transfers of every token the network knows, to or from `account`.
 * Never throws for RPC errors: returns what it read with `partial`.
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

  const shared = {
    fromBlock: '0x0',
    toBlock: 'latest',
    order: 'desc',
    maxCount: `0x${PAGE_SIZE.toString(16)}`,
    category: ['erc20'],
    contractAddresses: [...symbols.keys()],
  };
  const rpcUrl = network.rpcUrls.default.http[0];
  const kept = (
    sweep: Promise<{ transfers: RawTransfer[]; partial: boolean }>,
  ) =>
    sweep.catch((cause) => {
      console.warn('[transfers] asset transfers unavailable', cause);
      return { transfers: [], partial: true };
    });
  const sweeps = await Promise.all([
    kept(sweep(rpcUrl, { ...shared, toAddress: account })),
    kept(sweep(rpcUrl, { ...shared, fromAddress: account })),
  ]);

  const me = lower(account);
  const seen = new Set<string>();
  const wanted = sweeps
    .flatMap((s) => s.transfers)
    .filter((transfer) => {
      const { from, to, id } = transfer;
      if (seen.has(id)) return false;
      seen.add(id);
      const other = lower(lower(from) === me ? to : from);
      if (other === settlement) return lower(to) === me;
      return !skip.has(other) && lower(from) !== lower(to);
    });

  const rows = wanted.map((t): TransferRow => {
    return {
      tokenSymbol: symbols.get(lower(t.token)) ?? '',
      token: t.token,
      direction: lower(t.to) === me ? 'in' : 'out',
      amount: t.amount,
      decimals: t.decimals,
      txHash: t.txHash,
      blockNumber: t.blockNumber,
      timestamp: t.timestamp,
    };
  });
  return {
    rows,
    partial: sweeps.some((s) => s.partial),
  };
}

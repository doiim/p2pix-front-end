import type { Address, Hex } from 'viem';
import { NATIVE_TOKEN, TokenEnum, type SendToken } from '@/model/NetworkEnum';

export type UserOpHistoryEntry = {
  /** userOpHash — unique per operation. */
  id: Hex;
  token: SendToken;
  /** Raw amount in wei as a decimal string (bigint is not JSON-safe). */
  amount: string;
  to: Address;
  from: Address;
  chainId: number;
  /** Milliseconds since epoch. */
  timestamp: number;
  txHash?: Hex;
};

const CAP = 100;

const TOKEN_VALUES: string[] = [...Object.values(TokenEnum), NATIVE_TOKEN];

const key = (chainId: number, address: Address): string =>
  `p2pix.aa.history.${chainId}.${address.toLowerCase()}`;

const isEntry = (value: unknown): value is UserOpHistoryEntry => {
  const e = value as UserOpHistoryEntry;
  return (
    typeof e?.id === 'string' &&
    typeof e.timestamp === 'number' &&
    typeof e.amount === 'string' &&
    TOKEN_VALUES.includes(e.token)
  );
};

export const readHistory = (
  chainId: number,
  address: Address,
): UserOpHistoryEntry[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(key(chainId, address)) ?? '[]',
    );
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
};

/** Prepend (dedup by id, newest first, capped) and persist. */
export const appendHistory = (entry: UserOpHistoryEntry): void => {
  const rest = readHistory(entry.chainId, entry.from).filter(
    (item) => item.id !== entry.id,
  );
  try {
    localStorage.setItem(
      key(entry.chainId, entry.from),
      JSON.stringify([entry, ...rest].slice(0, CAP)),
    );
  } catch {
    // Storage full or unavailable — history is a convenience, not a ledger.
  }
};

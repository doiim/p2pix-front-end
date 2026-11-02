import { isAddress, isHex, type Address, type Hex } from 'viem';
import { allowlistRoot, shortHex } from './allowlist';

/**
 * Allowlists live only in this browser and in the file the seller downloads:
 * the contract stores just the root, and P2Pix runs no server to hold the
 * addresses. Sellers keep their own list per network; buyers keep the files
 * sellers send them.
 */
export type AllowlistEntry = {
  address: Address;
  /** Seller's label; never on-chain, but it is in the file the seller shares. */
  nickname?: string;
};

/** The `.json` a seller downloads, restores, and sends to buyers. */
export type AllowlistFile = {
  version: 1;
  chainId: number;
  seller: Address;
  root: Hex;
  entries: AllowlistEntry[];
};

export type ReceivedAllowlist = AllowlistFile & {
  fileName: string;
  /** Milliseconds since epoch. */
  importedAt: number;
};

const RECEIVED_KEY = 'p2pix.allowlist.received';

const ownKey = (chainId: number, owner: Address): string =>
  `p2pix.allowlist.own.${chainId}.${owner.toLowerCase()}`;

const readJson = (key: string): unknown => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
};

/** `false` when storage is full or unavailable; the downloaded file is the backup. */
const writeJson = (key: string, value: unknown): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
};

/** Bounds for an imported file, so a huge one cannot freeze the page. */
export const MAX_ALLOWLIST_ENTRIES = 5000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

/** pt-BR reason a picked file is too big to read, if it is. */
export const fileSizeError = (file: File): string | undefined =>
  file.size > MAX_FILE_BYTES
    ? 'Arquivo grande demais. Use o .json baixado nesta página.'
    : undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toEntry = (value: unknown): AllowlistEntry | null => {
  if (!isRecord(value)) return null;
  const { address, nickname } = value;
  if (typeof address !== 'string' || !isAddress(address)) return null;
  const label = typeof nickname === 'string' ? nickname.trim() : '';
  return label ? { address, nickname: label } : { address };
};

/** Valid entries only, first occurrence of each address kept. */
const toEntries = (value: unknown): AllowlistEntry[] => {
  const seen = new Set<string>();
  return (Array.isArray(value) ? value : [])
    .map(toEntry)
    .filter((entry): entry is AllowlistEntry => entry !== null)
    .filter((entry) => {
      const key = entry.address.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const entryLabel = (entry: AllowlistEntry): string =>
  entry.nickname ?? shortHex(entry.address);

export const addressesOf = (entries: readonly AllowlistEntry[]): Address[] =>
  entries.map((entry) => entry.address);

export const readOwnAllowlist = (
  chainId: number,
  owner: Address,
): AllowlistEntry[] => toEntries(readJson(ownKey(chainId, owner)));

export const writeOwnAllowlist = (
  chainId: number,
  owner: Address,
  entries: readonly AllowlistEntry[],
): boolean => writeJson(ownKey(chainId, owner), entries);

export const toAllowlistFile = (
  chainId: number,
  seller: Address,
  entries: AllowlistEntry[],
): AllowlistFile => ({
  version: 1,
  chainId,
  seller,
  root: allowlistRoot(addressesOf(entries)),
  entries,
});

/**
 * Validates an imported file. The root is recomputed from the entries, so a
 * hand-edited file shows its real root instead of the one written in it.
 */
export const parseAllowlistFile = (text: string): AllowlistFile | null => {
  const value = (() => {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return null;
    }
  })();
  if (!isRecord(value)) return null;
  const { chainId, seller, root, entries } = value;
  if (Array.isArray(entries) && entries.length > MAX_ALLOWLIST_ENTRIES) {
    return null;
  }
  if (typeof chainId !== 'number' || typeof seller !== 'string') return null;
  if (!isAddress(seller) || typeof root !== 'string' || !isHex(root)) {
    return null;
  }
  const valid = toEntries(entries);
  if (!valid.length) return null;
  return toAllowlistFile(chainId, seller, valid);
};

export const allowlistFileName = (
  networkName: string,
  seller: Address,
): string =>
  `lista-${networkName.toLowerCase().replace(/\s+/g, '-')}-${seller.slice(0, 6).toLowerCase()}.json`;

export const downloadAllowlistFile = (
  file: AllowlistFile,
  fileName: string,
): void => {
  const blob = new Blob([JSON.stringify(file, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const toReceived = (value: unknown): ReceivedAllowlist | null => {
  if (!isRecord(value)) return null;
  const file = parseAllowlistFile(JSON.stringify(value));
  const { fileName, importedAt } = value;
  if (!file || typeof fileName !== 'string') return null;
  if (typeof importedAt !== 'number') return null;
  return { ...file, fileName, importedAt };
};

export const readReceivedAllowlists = (): ReceivedAllowlist[] => {
  const value = readJson(RECEIVED_KEY);
  return (Array.isArray(value) ? value : [])
    .map(toReceived)
    .filter((list): list is ReceivedAllowlist => list !== null);
};

export const writeReceivedAllowlists = (
  lists: readonly ReceivedAllowlist[],
): boolean => writeJson(RECEIVED_KEY, lists);

/** Opens the system file dialog; stays pending if the user cancels. */
export const pickAllowlistFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });

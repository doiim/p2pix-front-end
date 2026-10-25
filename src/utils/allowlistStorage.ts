import { isAddress, isHex, type Address, type Hex } from 'viem';
import { allowlistRoot, sameAddress, shortHex } from './allowlist';

/**
 * Allowlists live only in this browser and in the file the seller downloads:
 * the contract stores just the root, and P2Pix runs no server to hold the
 * addresses. Sellers keep their own list per network; buyers keep the files
 * sellers send them.
 */
export type AllowlistEntry = {
  address: Address;
  /** Seller's private label; never sent to the network. */
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

const writeJson = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable; the downloaded file is the backup.
  }
};

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
const toEntries = (value: unknown): AllowlistEntry[] =>
  (Array.isArray(value) ? value : [])
    .map(toEntry)
    .filter((entry): entry is AllowlistEntry => entry !== null)
    .filter(
      (entry, index, all) =>
        all.findIndex((other) => sameAddress(other.address, entry.address)) ===
        index,
    );

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
): void => writeJson(ownKey(chainId, owner), entries);

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
): void => writeJson(RECEIVED_KEY, lists);

/** Opens the system file dialog; stays pending if the user cancels. */
export const pickAllowlistFile = (): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });

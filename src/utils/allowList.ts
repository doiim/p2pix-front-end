import {
  concat,
  isAddress,
  keccak256,
  toHex,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';

/**
 * A buyer in the seller's list. `saved` is in the root on the network, `new`
 * joins and `removed` leaves on the next save.
 */
export type AllowListEntry = {
  address: Address;
  label: string;
  status: 'saved' | 'new' | 'removed';
};

// The contract checks buyers with OpenZeppelin's MerkleProof: a leaf is the
// address itself, left-padded to 32 bytes (no hash), and a node is the
// keccak256 of its two children in sorted order.
const leafOf = (address: Address) => toHex(BigInt(address), { size: 32 });
const parentOf = (a: Hex, b: Hex) =>
  keccak256(a < b ? concat([a, b]) : concat([b, a]));

/** Every level of the list's tree, leaves first. */
const levelsOf = (addresses: Address[]): Hex[][] => {
  // lock() treats an empty proof as no proof, so a one-address list gets a
  // zero leaf; no one can call the contract from the zero address.
  const levels = [
    (addresses.length === 1 ? [...addresses, zeroAddress] : addresses)
      .map(leafOf)
      .sort(),
  ];
  while (levels[levels.length - 1].length > 1) {
    const level = levels[levels.length - 1];
    levels.push(
      Array.from({ length: Math.ceil(level.length / 2) }, (_, index) => {
        const right = level[2 * index + 1];
        return right ? parentOf(level[2 * index], right) : level[2 * index];
      }),
    );
  }
  return levels;
};

/** The root the contract stores; zero means no list. */
export const allowListRoot = (addresses: Address[]): Hex => {
  if (!addresses.length) return zeroHash;
  const levels = levelsOf(addresses);
  return levels[levels.length - 1][0];
};

/** The siblings that prove `buyer` belongs to the list. */
export const allowListProof = (addresses: Address[], buyer: Address): Hex[] => {
  const levels = levelsOf(addresses);
  const index = levels[0].indexOf(leafOf(buyer));
  return levels
    .slice(0, -1)
    .flatMap((level, depth) => level[(index >> depth) ^ 1] ?? []);
};

const storageKey = (chainId: number, seller: Address) =>
  `p2pix.allowList.${chainId}.${seller.toLowerCase()}`;

const isEntry = (value: unknown): value is AllowListEntry =>
  typeof value === 'object' &&
  value !== null &&
  'address' in value &&
  typeof value.address === 'string' &&
  isAddress(value.address) &&
  'label' in value &&
  typeof value.label === 'string' &&
  'status' in value &&
  (value.status === 'saved' ||
    value.status === 'new' ||
    value.status === 'removed');

/** The list kept in this browser for one seller on one network. */
export const readAllowList = (
  chainId: number,
  seller: Address,
): AllowListEntry[] => {
  const parsed: unknown = JSON.parse(
    localStorage.getItem(storageKey(chainId, seller)) ?? '[]',
  );
  return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
};

export const writeAllowList = (
  chainId: number,
  seller: Address,
  entries: AllowListEntry[],
) => localStorage.setItem(storageKey(chainId, seller), JSON.stringify(entries));

/** The buyers in a downloaded list file, or null when it is not one. */
export const parseAllowListFile = (
  text: string,
): Pick<AllowListEntry, 'address' | 'label'>[] | null => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON, so not a list file either; the caller tells the seller.
    return null;
  }
  const buyers =
    typeof parsed === 'object' && parsed !== null && 'compradores' in parsed
      ? parsed.compradores
      : null;
  if (!Array.isArray(buyers)) return null;
  const entries = buyers.flatMap((buyer: unknown) =>
    typeof buyer === 'object' &&
    buyer !== null &&
    'endereco' in buyer &&
    typeof buyer.endereco === 'string' &&
    isAddress(buyer.endereco)
      ? [
          {
            address: buyer.endereco,
            label:
              'apelido' in buyer && typeof buyer.apelido === 'string'
                ? buyer.apelido
                : '',
          },
        ]
      : [],
  );
  return entries.length === buyers.length ? entries : null;
};

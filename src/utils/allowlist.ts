import {
  concat,
  isAddress,
  keccak256,
  pad,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';

const HEX_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** pt-BR reason the text is not a usable buyer address, if any. */
export const addressError = (text: string): string | undefined => {
  if (!HEX_ADDRESS.test(text)) {
    return 'Use 0x seguido de 40 caracteres hexadecimais.';
  }
  // Mixed case carries an EIP-55 checksum; a mistyped character breaks it.
  if (!isAddress(text, { strict: true })) {
    return 'Algum caractere foi digitado errado (checksum inválido).';
  }
  if (text.toLowerCase() === zeroAddress) return 'Endereço zero não vale.';
  return undefined;
};

export const sameAddress = (a: string, b: string): boolean =>
  a.toLowerCase() === b.toLowerCase();

// Same scheme as the contract's fixtures (merkletreejs, `sort: true`) and
// OpenZeppelin's MerkleProof: leaf = bytes32(uint160(address)), unhashed;
// pairs hashed in sorted order; an odd node is carried up unchanged.
const leafOf = (address: Address): Hex =>
  pad(address.toLowerCase() as Hex, { size: 32 });

const hashPair = (a: Hex, b: Hex): Hex =>
  keccak256(concat(a < b ? [a, b] : [b, a]));

/**
 * `lock` only checks a proof when it is non-empty, and a one-leaf tree has an
 * empty proof, so a lone buyer is paired with a zero leaf. No caller can be
 * the zero address, so that leaf admits nobody.
 */
const leavesOf = (addresses: readonly Address[]): Hex[] => {
  const leaves = [...new Set(addresses.map(leafOf))].sort();
  return leaves.length === 1 ? [zeroHash, ...leaves] : leaves;
};

const buildLayers = (addresses: readonly Address[]): Hex[][] => {
  const layers: Hex[][] = [leavesOf(addresses)];
  let layer = layers[0];
  while (layer.length > 1) {
    const next: Hex[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const right = layer[i + 1];
      next.push(right ? hashPair(layer[i], right) : layer[i]);
    }
    layers.push(next);
    layer = next;
  }
  return layers;
};

/** Zero for an empty list, which is also how a seller turns the list off. */
export const allowlistRoot = (addresses: readonly Address[]): Hex =>
  buildLayers(addresses).at(-1)?.[0] ?? zeroHash;

/** `null` when `address` is not on the list. */
export const allowlistProof = (
  addresses: readonly Address[],
  address: Address,
): Hex[] | null => {
  const layers = buildLayers(addresses);
  let index = layers[0].indexOf(leafOf(address));
  if (index < 0) return null;

  const proof: Hex[] = [];
  for (const layer of layers.slice(0, -1)) {
    const sibling = layer[index ^ 1];
    if (sibling) proof.push(sibling);
    index >>= 1;
  }
  return proof;
};

export const isOnAllowlist = (
  addresses: readonly Address[],
  address: Address,
): boolean => addresses.some((item) => sameAddress(item, address));

/** `0x1a2b…9f3e`-style short form used across the allowlist screens. */
export const shortHex = (value: string, head = 6, tail = 4): string =>
  `${value.slice(0, head)}…${value.slice(-tail)}`;

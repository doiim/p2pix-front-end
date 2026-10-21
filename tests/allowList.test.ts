import {
  concat,
  keccak256,
  toHex,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import { describe, expect, it } from 'vitest';
import {
  allowListProof,
  allowListRoot,
  parseAllowListFile,
} from '@/utils/allowList';

// OpenZeppelin's MerkleProof.processProof, which P2Pix's lock() runs.
const processProof = (proof: Hex[], leaf: Hex) =>
  proof.reduce(
    (node, sibling) =>
      keccak256(
        node < sibling ? concat([node, sibling]) : concat([sibling, node]),
      ),
    leaf,
  );
const leafOf = (address: Address) => toHex(BigInt(address), { size: 32 });

// The list from the design (2F1), whose roots the design computed itself.
const marina = '0x5e8fc82fbc4129c2b7c27b723dc0097a7a5121ab';
const paulo = '0x9d046273681e68cfa11d5d2ccf1a2e0109d97c55';
const unnamed = '0x3b710d004aa8dcb4e4bf72e27b78d0d9e0dee0d2';
const old = '0x77e2957e83a0dcad090211bf1de9e29f2ea4b9a0';
const rafael = '0xc4a97c70e7798a0f1f0881653eeb46102951118f';

describe('allow list', () => {
  it('matches the roots shown in the design', () => {
    expect(allowListRoot([marina, paulo, unnamed, old])).toMatch(
      /^0xb410.*de86$/,
    );
    expect(allowListRoot([marina, paulo, unnamed, rafael])).toMatch(
      /^0x6ad6.*e39a$/,
    );
  });

  it('is zero without addresses', () => {
    expect(allowListRoot([])).toBe(zeroHash);
  });

  it('proves every member of lists of any size, never with an empty proof', () => {
    const addresses: Address[] = [marina, paulo, unnamed, old, rafael];
    for (let size = 1; size <= addresses.length; size++) {
      const list = addresses.slice(0, size);
      const root = allowListRoot(list);
      for (const buyer of list) {
        const proof = allowListProof(list, buyer);
        expect(proof.length).toBeGreaterThan(0);
        expect(processProof(proof, leafOf(buyer))).toBe(root);
      }
    }
  });

  it('does not depend on the order the addresses were added', () => {
    expect(allowListRoot([rafael, marina, paulo])).toBe(
      allowListRoot([paulo, rafael, marina]),
    );
  });

  it('reads a downloaded list file and rejects anything else', () => {
    expect(
      parseAllowListFile(
        JSON.stringify({
          compradores: [
            { endereco: marina, apelido: 'Marina' },
            { endereco: paulo },
          ],
        }),
      ),
    ).toEqual([
      { address: marina, label: 'Marina' },
      { address: paulo, label: '' },
    ]);
    expect(parseAllowListFile('not json')).toBeNull();
    expect(
      parseAllowListFile('{"compradores":[{"endereco":"0x12"}]}'),
    ).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  decodeFunctionData,
  encodeFunctionData,
  recoverAddress,
  type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { p2PixAbi } from '@/blockchain/abi';
import {
  pixProofDigest,
  toPixProof,
  type PixProof,
  type RawProof,
} from '@/utils/pixProof';

const BANK = {
  solicitationUrlPrefix:
    'https://api-bbpay.hm.bb.com.br/checkout/v2/solicitacoes/',
  solicitationUrlSuffix: '?numeroConvenio=701&gw-dev-app-key=test',
};

/** As the attestor renders it: keys sorted, every value a string. */
const DATA = JSON.stringify({
  amount: '100.00',
  lock: '11155111-42',
  payee: '101',
  settled: '100.00',
  txId: 'E1',
});

const proof = (over: Partial<PixProof> = {}): PixProof => ({
  ...toPixProof('1408799', {
    recipient: '0x8963E134E6d22Ee9A26ac62a99964aB391ead816',
    attestor: '0x0DE886e31723e64Aa72e51977B14475fB66a9f72',
    data: DATA,
    timestamp: 1766377317483,
    additionParams: '{"algorithmType":"proxytls"}',
    attConditions: '',
    signature: `0x${'ab'.repeat(65)}`,
  }),
  ...over,
});

/**
 * Produced by the contracts' own test helper (`test/utils/proof.ts`,
 * `proofDigest`) for the same input (BANK, including its suffix, and DATA),
 * so the client and the contract agree on what the attestor signs.
 */
const CONTRACT_DIGEST =
  '0xb6e14c8adbc9b27b2ec02b272aa4bc36086f27586aa4074fbc0c86b391b383a8';

describe('pixProofDigest', () => {
  it('matches the digest the contract rebuilds', () => {
    expect(pixProofDigest(proof(), BANK)).toBe(CONTRACT_DIGEST);
  });

  it('recovers the attestor from a raw-digest signature', async () => {
    const attestor = privateKeyToAccount(`0x${'11'.repeat(32)}`);
    const digest = pixProofDigest(proof(), BANK);
    // Primus attestors sign the digest itself: no EIP-191 prefix.
    const signature = await attestor.sign({ hash: digest });
    const signed = proof({ attestor: attestor.address, signature });
    expect(
      await recoverAddress({ hash: pixProofDigest(signed, BANK), signature }),
    ).toBe(attestor.address);
  });

  it('changes with the solicitation number and the payee', () => {
    const base = pixProofDigest(proof(), BANK);
    expect(pixProofDigest(proof({ numeroSolicitacao: 1n }), BANK)).not.toBe(
      base,
    );
    expect(
      pixProofDigest(
        proof({ data: DATA.replace('"payee":"101"', '"payee":"102"') }),
        BANK,
      ),
    ).not.toBe(base);
  });
});

// The proof captured from BB homologação (gitignored: its URL carries the
// sandbox app key). Skipped when the file is absent.
const FIXTURE = resolve(__dirname, '../fixtures/pixProof.json');
describe.skipIf(!existsSync(FIXTURE))('captured proof', () => {
  it('recovers the Primus attestor under the contract rebuild rules', async () => {
    const body = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
      numeroSolicitacao: string;
      proof: RawProof & { requests: { url: string }[] };
    };
    const n = body.numeroSolicitacao;
    const url = body.proof.requests[0].url;
    const at = url.indexOf(`/${n}?`) + 1;
    const bank = {
      solicitationUrlPrefix: url.slice(0, at),
      solicitationUrlSuffix: url.slice(at + n.length),
    };
    const signed = toPixProof(n, body.proof);
    const recovered = await recoverAddress({
      hash: pixProofDigest(signed, bank),
      signature: signed.signature,
    });
    expect(recovered.toLowerCase()).toBe(signed.attestor.toLowerCase());
  });
});

describe('release calldata', () => {
  it('round-trips the proof through the ABI', () => {
    const args = [42n, proof()] as const;
    const data: Hex = encodeFunctionData({
      abi: p2PixAbi,
      functionName: 'release',
      args,
    });
    const decoded = decodeFunctionData({ abi: p2PixAbi, data });
    expect(decoded.functionName).toBe('release');
    expect(decoded.args).toEqual(args);
  });
});

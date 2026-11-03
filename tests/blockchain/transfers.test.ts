import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import { readTokenTransfers } from '@/blockchain/transfers';
import type { NetworkConfig } from '@/model/NetworkEnum';

const ACCOUNT: Address = '0x1111111111111111111111111111111111111111';
const OTHER: Address = '0x2222222222222222222222222222222222222222';
const BRZ: Address = '0x3333333333333333333333333333333333333333';
const USDT: Address = '0x4444444444444444444444444444444444444444';
const SETTLEMENT: Address = '0x9008D19f58AAbD9eD0D60971565AA8510560ab41';
const P2PIX: Address = '0x5555555555555555555555555555555555555555';

const network = {
  rpcUrls: { default: { http: ['https://rpc.test'] } },
  tokens: { BRZ: { address: BRZ } },
  contracts: { p2pix: { address: P2PIX } },
  swap: {
    apiUrl: 'https://api.cow.fi/test',
    settlement: SETTLEMENT,
    tokens: [{ symbol: 'USDT', name: 'Tether USD', address: USDT }],
  },
} as typeof network & NetworkConfig;

// The asset-transfers API is the boundary: rows are shaped as it answers them.
const row = (over: Record<string, unknown> = {}) => ({
  blockNum: '0x10',
  uniqueId: 'u1',
  hash: '0x93aef6b7a91e017c89e3412f6abe3584d469d7cf97f5b2483748b95b44b7f7b2',
  from: OTHER,
  to: ACCOUNT,
  rawContract: {
    value: '0x0de0b6b3a7640000',
    address: BRZ,
    decimal: '0x12',
  },
  metadata: { blockTimestamp: '2026-11-01T12:00:00.000Z' },
  ...over,
});

const fetchMock = vi.fn();

const rpcAnswer = (result: unknown) => ({
  ok: true,
  json: async () => ({ result }),
});

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('readTokenTransfers', () => {
  it('keeps a well-formed transfer with its raw amount and decimals', async () => {
    fetchMock.mockImplementation(async () => rpcAnswer({ transfers: [row()] }));

    const { rows, partial } = await readTokenTransfers(network, ACCOUNT);

    expect(partial).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tokenSymbol: 'BRZ',
      direction: 'in',
      amount: 10n ** 18n,
      decimals: 18,
      txHash:
        '0x93aef6b7a91e017c89e3412f6abe3584d469d7cf97f5b2483748b95b44b7f7b2',
    });
    expect(rows[0].timestamp).toBe(Date.parse('2026-11-01T12:00:00.000Z'));
  });

  it('drops a malformed transfer instead of the whole history', async () => {
    fetchMock.mockImplementation(async () =>
      rpcAnswer({
        transfers: [
          row(),
          row({
            uniqueId: 'u2',
            rawContract: { value: 'garbage', address: BRZ, decimal: '0x12' },
          }),
          row({ uniqueId: 'u3', from: 'not-an-address' }),
        ],
      }),
    );

    const { rows } = await readTokenTransfers(network, ACCOUNT);

    expect(rows).toHaveLength(1);
  });

  it('counts one transfer listed twice once', async () => {
    fetchMock.mockImplementation(async () =>
      rpcAnswer({ transfers: [row(), row()] }),
    );

    const { rows } = await readTokenTransfers(network, ACCOUNT);

    expect(rows).toHaveLength(1);
  });

  it('hides what went to the CoW settlement and shows what came back', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      const out = body.params[0].fromAddress === ACCOUNT;
      return rpcAnswer({
        transfers: out
          ? [row({ uniqueId: 'sold', from: ACCOUNT, to: SETTLEMENT })]
          : [row({ uniqueId: 'bought', from: SETTLEMENT, to: ACCOUNT })],
      });
    });

    const { rows } = await readTokenTransfers(network, ACCOUNT);

    expect(rows).toHaveLength(1);
    expect(rows[0].direction).toBe('in');
  });

  it('keeps one direction when the other fails, and says partial', async () => {
    fetchMock.mockImplementation(async (_url, init) => {
      const body = JSON.parse(init.body);
      return body.params[0].toAddress === ACCOUNT
        ? rpcAnswer({ transfers: [row()] })
        : { ok: false, json: async () => ({}) };
    });

    const { rows, partial } = await readTokenTransfers(network, ACCOUNT);

    expect(rows).toHaveLength(1);
    expect(partial).toBe(true);
  });

  it('says partial when the history outlives the page budget', async () => {
    fetchMock.mockImplementation(async () =>
      rpcAnswer({ transfers: [row()], pageKey: 'next' }),
    );

    const { rows, partial } = await readTokenTransfers(network, ACCOUNT);

    expect(partial).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('an endpoint without the transfers API reads as partial, never throws', async () => {
    fetchMock.mockImplementation(async () => ({
      ok: true,
      json: async () => ({ error: { code: -32601, message: 'not found' } }),
    }));

    await expect(readTokenTransfers(network, ACCOUNT)).resolves.toEqual({
      rows: [],
      partial: true,
    });
  });
});

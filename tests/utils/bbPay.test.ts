import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSolicitation, getSolicitation } from '@/utils/bbPay';

const RAW_PROOF = {
  recipient: '0x8963e134e6d22ee9a26ac62a99964ab391ead816',
  attestor: '0x0DE886e31723e64Aa72e51977B14475fB66a9f72',
  data: '{"amount":"100","payee":"101"}',
  timestamp: 1766377317483,
  additionParams: '{"algorithmType":"proxytls"}',
  attConditions: '',
  signature: `0x${'ab'.repeat(65)}`,
  taskId: `0x${'cd'.repeat(32)}`,
};

const answer = (status: number, body?: unknown) =>
  vi.fn().mockResolvedValue(
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSolicitation', () => {
  it.each([402, 202, 503])('resolves null on %d', async (status) => {
    vi.stubGlobal('fetch', answer(status, { error: 'not yet' }));
    expect(await getSolicitation('1408799')).toBeNull();
  });

  it('returns the proof with bigint numbers on 200', async () => {
    vi.stubGlobal(
      'fetch',
      answer(200, { numeroSolicitacao: '1408799', proof: RAW_PROOF }),
    );
    const proof = await getSolicitation('1408799');
    expect(proof).not.toBeNull();
    expect(proof!.numeroSolicitacao).toBe(1408799n);
    expect(proof!.timestamp).toBe(1766377317483n);
    expect(proof!.attestor).toBe(RAW_PROOF.attestor);
    expect(proof!.data).toBe(RAW_PROOF.data);
    expect(proof!.signature).toBe(RAW_PROOF.signature);
  });

  it('polls the release endpoint of the given solicitation', async () => {
    const fetchMock = answer(402);
    vi.stubGlobal('fetch', fetchMock);
    await getSolicitation('42');
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/release\/42$/);
  });

  it('throws on a server error', async () => {
    vi.stubGlobal('fetch', answer(500, { error: 'Internal server error' }));
    await expect(getSolicitation('1408799')).rejects.toThrow('500');
  });

  it('throws on a 200 answer without a proof', async () => {
    vi.stubGlobal('fetch', answer(200, { pixTimestamp: '0x00' }));
    await expect(getSolicitation('1408799')).rejects.toThrow(
      'Unexpected /release answer',
    );
  });
});

describe('createSolicitation', () => {
  it('binds the charge to the lock and sends the bare participant number', async () => {
    const fetchMock = answer(200, {
      numeroSolicitacao: 1408799,
      informacoesPix: { textoQrCode: '000201…' },
    });
    vi.stubGlobal('fetch', fetchMock);
    const solicitation = await createSolicitation({
      amount: 100,
      sellerId: '11155111-101',
      lockID: 42n,
      chainId: 11155111,
    });
    expect(fetchMock.mock.calls[0][0]).toMatch(/\/request$/);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      amount: 100,
      pixTarget: '101',
      lockId: '42',
      chainId: 11155111,
    });
    expect(solicitation).toEqual({
      numeroSolicitacao: '1408799',
      textoQrCode: '000201…',
    });
  });

  it('throws when the prover rejects the request', async () => {
    vi.stubGlobal('fetch', answer(400, { error: 'lockId required' }));
    await expect(
      createSolicitation({
        amount: 100,
        sellerId: '11155111-101',
        lockID: 42n,
        chainId: 11155111,
      }),
    ).rejects.toThrow('400');
  });
});

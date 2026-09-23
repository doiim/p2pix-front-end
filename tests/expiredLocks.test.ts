import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  readContract: vi.fn(),
  writeContract: vi.fn(),
  simulateContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  sendAaOperation: vi.fn(),
  getActiveAaContext: vi.fn(),
}));

vi.mock('@/composables/useUser', () => ({
  useUser: () => ({
    network: { value: { subgraphUrls: ['http://subgraph.test'] } },
  }),
}));

vi.mock('@/blockchain/provider', () => ({
  getContract: vi.fn(async (onlyRpc = false) => ({
    address: '0x0000000000000000000000000000000000000001',
    abi: [],
    client: {
      readContract: h.readContract,
      simulateContract: h.simulateContract,
      waitForTransactionReceipt: h.waitForTransactionReceipt,
    },
    wallet: onlyRpc ? null : { writeContract: h.writeContract },
    account: onlyRpc ? null : '0x0000000000000000000000000000000000000002',
  })),
}));

vi.mock('@/blockchain/aa/operations', () => ({
  getEffectiveWalletAddress: vi.fn(),
  getActiveAaContext: h.getActiveAaContext,
  sendAaOperation: h.sendAaOperation,
}));

vi.mock('@/blockchain/events', () => ({
  getValidDeposits: vi.fn(),
  getUnreleasedLockById: vi.fn(),
}));

import { getExpiredLockIds, sweepExpiredLocks } from '@/blockchain/wallet';
import { LockStatus } from '@/model/LockStatus';

const jsonResponse = (lockIds: string[]) => ({
  ok: true,
  json: async () => ({
    data: { lockAddeds: lockIds.map((lockID) => ({ lockID })) },
  }),
});

beforeEach(() => {
  vi.clearAllMocks();
  h.getActiveAaContext.mockResolvedValue(null);
});

describe('getExpiredLockIds', () => {
  it('keeps only Expired locks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(['1', '2', '3'])),
    );
    h.readContract.mockResolvedValue([
      [1n, 2n, 3n],
      [LockStatus.Expired, LockStatus.Active, LockStatus.Released],
    ]);

    await expect(getExpiredLockIds('0xseller' as never)).resolves.toEqual([1n]);
  });

  it('returns [] without reading status when there are no locks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    );

    await expect(getExpiredLockIds('0xseller' as never)).resolves.toEqual([]);
    expect(h.readContract).not.toHaveBeenCalled();
  });
});

describe('sweepExpiredLocks', () => {
  it('is a no-op returning 0 and sends no transaction when empty', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse([])),
    );

    await expect(
      sweepExpiredLocks('0xseller' as never, '0xtoken' as never),
    ).resolves.toBe(0);
    expect(h.sendAaOperation).not.toHaveBeenCalled();
    expect(h.writeContract).not.toHaveBeenCalled();
    expect(h.getActiveAaContext).not.toHaveBeenCalled();
  });

  it('calls unlockExpired with the seller expired ids on the EOA rail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(['7', '8'])),
    );
    h.readContract.mockResolvedValue([
      [7n, 8n],
      [LockStatus.Expired, LockStatus.Expired],
    ]);
    h.simulateContract.mockResolvedValue({ request: { mocked: true } });
    h.writeContract.mockResolvedValue('0xhash');
    h.waitForTransactionReceipt.mockResolvedValue({
      status: 'success',
      transactionHash: '0xhash',
    });

    await expect(
      sweepExpiredLocks('0xseller' as never, '0xtoken' as never),
    ).resolves.toBe(2);

    expect(h.simulateContract).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: 'unlockExpired',
        args: [[7n, 8n]],
      }),
    );
    expect(h.writeContract).toHaveBeenCalledTimes(1);
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { parseEther, type Address } from 'viem';

const mocks = vi.hoisted(() => ({
  getContract: vi.fn(),
}));

vi.mock('./provider', () => ({ getContract: mocks.getContract }));

import { getUnreleasedLockById } from './events';

const P2PIX = `0x${'1'.repeat(40)}` as Address;
const TOKEN = `0x${'2'.repeat(40)}` as Address;
const BUYER = `0x${'3'.repeat(40)}` as Address;
const SELLER = `0x${'4'.repeat(40)}` as Address;
const ORDER_ID = `0x${'5'.repeat(64)}` as const;
const PIX_TARGET = `0x${'6'.repeat(64)}` as const;

describe('P2Pix v2 lock decoding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('skips orderId and preserves the public unreleased-lock shape', async () => {
    const readContract = vi
      .fn()
      .mockResolvedValue([
        7n,
        ORDER_ID,
        10_000n,
        PIX_TARGET,
        parseEther('2.5'),
        TOKEN,
        BUYER,
        SELLER,
      ]);
    mocks.getContract.mockResolvedValue({
      address: P2PIX,
      abi: [],
      client: { readContract },
    });

    await expect(getUnreleasedLockById(7n)).resolves.toEqual({
      lockID: 7n,
      amount: 2.5,
      tokenAddress: TOKEN,
      sellerAddress: SELLER,
    });
    expect(readContract).toHaveBeenCalledWith({
      address: P2PIX,
      abi: [],
      functionName: 'mapLocks',
      args: [7n],
    });
  });
});

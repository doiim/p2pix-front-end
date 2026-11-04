import { describe, expect, it } from 'vitest';
import { arbitrum, sepolia } from 'viem/chains';
import {
  contractBlockNumber,
  countdownText,
  secondsToExpiry,
} from '@/utils/lockExpiry';

describe('contractBlockNumber', () => {
  it('uses the L1 number on Arbitrum', () => {
    const block = { number: 400_000_000n, l1BlockNumber: '0x1312d00' };
    expect(contractBlockNumber(arbitrum.id, block)).toBe(20_000_000n);
  });

  it('gives no clock when Arbitrum omits or garbles l1BlockNumber', () => {
    expect(contractBlockNumber(arbitrum.id, { number: 5n })).toBeNull();
    expect(
      contractBlockNumber(arbitrum.id, { number: 5n, l1BlockNumber: 'zz' }),
    ).toBeNull();
  });

  it('uses the block number on L1 chains', () => {
    expect(contractBlockNumber(sepolia.id, { number: 7n })).toBe(7n);
  });
});

describe('secondsToExpiry', () => {
  it('is blocks left times 12 s, floored at 0', () => {
    expect(secondsToExpiry(sepolia.id, 110n, { number: 100n })).toBe(120);
    expect(secondsToExpiry(sepolia.id, 90n, { number: 100n })).toBe(0);
  });

  it('is null on an unknown chain or an emptied lock', () => {
    expect(secondsToExpiry(31337, 110n, { number: 100n })).toBeNull();
    expect(secondsToExpiry(sepolia.id, 0n, { number: 100n })).toBeNull();
  });
});

describe('countdownText', () => {
  it('formats the three ranges', () => {
    expect(countdownText(3 * 3600 + 5 * 60 + 9)).toBe('Pague em até 03:05:09');
    expect(countdownText(2 * 86400 + 1)).toBe('Pague em até 3 dias');
    expect(countdownText(125)).toBe('Pague logo: a reserva expira em 02:05');
  });
});

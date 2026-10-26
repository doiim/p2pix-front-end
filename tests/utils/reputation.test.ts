import { describe, expect, it } from 'vitest';
import { parseEther } from 'viem';

import { creditTokensFromWei, effectiveLimit } from '@/utils/reputation';

const sqrt = (x: bigint): bigint => {
  if (x < 2n) return x;
  let z = x;
  let y = (x + 1n) / 2n;
  while (y < z) {
    z = y;
    y = (x / y + y) / 2n;
  }
  return z;
};

// Reputation.sol `limiter`, integer math as on chain.
const limiter = (credit: bigint) =>
  256n + (1_000_000n * credit) / sqrt(250_000_000_000n + credit * credit);

// p2pix.sol: `userRecord` is wei-scaled credit, the limiter takes whole tokens.
const limitFor = (credit: string) =>
  effectiveLimit(limiter(creditTokensFromWei(parseEther(credit))));

describe('effectiveLimit', () => {
  it.each([
    ['0', 256n],
    ['5', 266n],
    ['5.9', 266n],
    ['1000', 2256n],
  ])('%s tokens of credit allow %i tokens', (credit, limit) => {
    expect(limitFor(credit)).toBe(limit);
  });

  it('caps at the per-lock upper bound of 1e6 tokens', () => {
    expect(limitFor('1000000000000')).toBe(1_000_000n);
  });

  it('never goes below the 100-token lower bound', () => {
    expect(effectiveLimit(50n)).toBe(100n);
  });
});

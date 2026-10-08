import { parseEther } from 'viem';
import { describe, expect, it } from 'vitest';
import {
  LOCKAMOUNT_UPPERBOUND_TOKENS,
  REPUTATION_LOWERBOUND_TOKENS,
  WAD,
  amountInputText,
  castAddrToKey,
  classifyAmount,
  creditNeeded,
  creditTokensFromWei,
  effectiveLimit,
  limitRowVariant,
  limiterReplica,
  maxFill,
  parseAmountInput,
  solmateSqrt,
} from '@/utils/reputation';
import type { AmountVerdict, ReputationCurve } from '@/utils/reputation';

// The two curves deployed on 2026-10-06 (plan §2.4): BASE 256 on Arbitrum One, BASE 1 elsewhere.
const ARBITRUM: ReputationCurve = {
  base: 256n,
  maxLimit: 1_000_000n,
  magicValue: 250_000_000_000n,
};
const BASE_ONE: ReputationCurve = { ...ARBITRUM, base: 1n };

const MAX_UINT256 = 2n ** 256n - 1n;
const MASK64 = 2n ** 64n - 1n;
// splitmix64: deterministic pseudo-random words, so failures reproduce.
const splitmix = (index: bigint): bigint => {
  const a = (index * 0x9e3779b97f4a7c15n + 0x9e3779b97f4a7c15n) & MASK64;
  const b = ((a ^ (a >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  const c = ((b ^ (b >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  return c ^ (c >> 31n);
};
const random256 = (index: number): bigint =>
  [0n, 1n, 2n, 3n].reduce(
    (acc, word) => (acc << 64n) | splitmix(BigInt(index) * 4n + word),
    0n,
  );

const isFloorSqrt = (x: bigint, root: bigint) =>
  root * root <= x && (root + 1n) * (root + 1n) > x;

const limitAt = (curve: ReputationCurve, credit: bigint): bigint => {
  const value = limiterReplica(curve, credit);
  if (value === null) throw new Error(`replica undefined at ${credit}`);
  return effectiveLimit(value);
};

const centsToWei = (cents: bigint) => cents * 10n ** 16n;

describe('solmateSqrt', () => {
  it('is the floor square root for every small value', () => {
    Array.from({ length: 5000 }, (_, i) => BigInt(i)).forEach((x) =>
      expect(isFloorSqrt(x, solmateSqrt(x)), `x = ${x}`).toBe(true),
    );
  });

  it('handles 0 through the EVM div-by-zero rule', () => {
    expect(solmateSqrt(0n)).toBe(0n);
    expect(solmateSqrt(1n)).toBe(1n);
    expect(solmateSqrt(2n)).toBe(1n);
  });

  it('is exact at every power of two and its neighbours up to 2^256 − 1', () => {
    const values = Array.from({ length: 256 }, (_, k) => 2n ** BigInt(k))
      .flatMap((p) => [p - 1n, p, p + 1n])
      .concat([MAX_UINT256, MAX_UINT256 - 1n]);
    values.forEach((x) =>
      expect(isFloorSqrt(x, solmateSqrt(x)), `x = ${x}`).toBe(true),
    );
    expect(solmateSqrt(MAX_UINT256)).toBe(2n ** 128n - 1n);
  });

  it('is exact on perfect squares and their neighbours', () => {
    Array.from({ length: 3000 }, (_, i) => random256(i) >> 128n).forEach(
      (root) => {
        const square = root * root;
        expect(solmateSqrt(square)).toBe(root);
        expect(isFloorSqrt(square + 1n, solmateSqrt(square + 1n))).toBe(true);
        if (square > 0n) expect(solmateSqrt(square - 1n)).toBe(root - 1n);
      },
    );
  });

  it('is exact on random values of every magnitude', () => {
    Array.from({ length: 6000 }, (_, i) => random256(i) >> BigInt(i % 256))
      .concat([250_000_000_000n, 250_000_000_000n + 1_000_000n ** 2n])
      .forEach((x) =>
        expect(isFloorSqrt(x, solmateSqrt(x)), `x = ${x}`).toBe(true),
      );
  });
});

describe('limiterReplica', () => {
  const credits = [
    0n,
    1n,
    10n,
    49n,
    50n,
    100n,
    250n,
    500n,
    1000n,
    5000n,
    10_000n,
    50_000n,
    100_000n,
    500_000n,
    1_000_000n,
    10_000_000n,
  ];

  it('reproduces the plan §2.5 table for BASE 256 (Arbitrum One)', () => {
    expect(credits.map((c) => limiterReplica(ARBITRUM, c))).toEqual([
      256n,
      258n,
      276n,
      354n,
      356n,
      456n,
      756n,
      1256n,
      2256n,
      10_255n,
      20_252n,
      99_759n,
      196_372n,
      707_363n,
      894_683n,
      999_008n,
    ]);
  });

  it('reproduces the plan §2.5 table for BASE 1 (Ethereum, Sepolia, Rootstock Testnet)', () => {
    expect(credits.map((c) => limiterReplica(BASE_ONE, c))).toEqual([
      1n,
      3n,
      21n,
      99n,
      101n,
      201n,
      501n,
      1001n,
      2001n,
      10_000n,
      19_997n,
      99_504n,
      196_117n,
      707_108n,
      894_428n,
      998_753n,
    ]);
    expect(credits.map((c) => limitAt(BASE_ONE, c))).toEqual([
      100n,
      100n,
      100n,
      100n,
      101n,
      201n,
      501n,
      1001n,
      2001n,
      10_000n,
      19_997n,
      99_504n,
      196_117n,
      707_108n,
      894_428n,
      998_753n,
    ]);
  });

  it('gives the "Como funciona" next limit: limiter(1000 + 2256) = 6767', () => {
    expect(limiterReplica(ARBITRUM, 1000n + 2256n)).toBe(6767n);
  });

  it('reproduces the plan §2.5 ladders (buy the max, release, repeat)', () => {
    const ladder = (curve: ReputationCurve) =>
      Array.from({ length: 8 }).reduce<{ credit: bigint; limits: bigint[] }>(
        (acc) => {
          const limit = limitAt(curve, acc.credit);
          return { credit: acc.credit + limit, limits: [...acc.limits, limit] };
        },
        { credit: 0n, limits: [] },
      ).limits;
    expect(ladder(ARBITRUM)).toEqual([
      256n,
      768n,
      2303n,
      6909n,
      20_723n,
      62_055n,
      183_146n,
      483_733n,
    ]);
    expect(ladder(BASE_ONE)).toEqual([
      100n,
      201n,
      603n,
      1809n,
      5426n,
      16_276n,
      48_772n,
      144_831n,
    ]);
  });

  it('returns null wherever Solidity would revert', () => {
    expect(limiterReplica({ ...ARBITRUM, magicValue: 0n }, 0n)).toBeNull();
    expect(limiterReplica(ARBITRUM, 2n ** 128n)).toBeNull();
    expect(
      limiterReplica({ ...ARBITRUM, maxLimit: 2n ** 255n }, 2n),
    ).toBeNull();
    expect(limiterReplica({ ...ARBITRUM, base: MAX_UINT256 }, 0n)).toBe(
      MAX_UINT256,
    );
    expect(limiterReplica({ ...ARBITRUM, base: MAX_UINT256 }, 1n)).toBeNull();
    expect(limiterReplica(ARBITRUM, 2n ** 128n - 1n)).toBe(256n + 1_000_000n);
  });
});

describe('creditNeeded', () => {
  const targets = [500n, 1000n, 3000n, 5000n, 10_000n, 100_000n, 1_000_000n];
  const reaches = (curve: ReputationCurve, credit: bigint, cents: bigint) =>
    limitAt(curve, credit) * 100n >= cents;

  it('reproduces the plan §2.5 credit-needed table for BASE 256', () => {
    expect(targets.map((t) => creditNeeded(ARBITRUM, t * 100n))).toEqual([
      122n,
      372n,
      1373n,
      2373n,
      4873n,
      50_122n,
      22_092_000n,
    ]);
  });

  it('searches past 4e7: the BASE 1 cap needs 353,107,168 (spec A5)', () => {
    expect(targets.map((t) => creditNeeded(BASE_ONE, t * 100n))).toEqual([
      250n,
      500n,
      1500n,
      2500n,
      5000n,
      50_252n,
      353_107_168n,
    ]);
  });

  it('is the minimal credit whose effective limit covers the amount', () => {
    const curves = [
      ARBITRUM,
      BASE_ONE,
      { base: 40n, maxLimit: 300_000n, magicValue: 9_000_000_000n },
    ];
    curves.forEach((curve) =>
      Array.from(
        { length: 400 },
        (_, i) => (splitmix(BigInt(i)) % 100_000_000n) + 1n,
      ).forEach((cents) => {
        const need = creditNeeded(curve, cents);
        if (need === null) {
          expect(reaches(curve, 2n ** 64n, cents)).toBe(false);
          return;
        }
        expect(reaches(curve, need, cents), `${cents} cents`).toBe(true);
        if (need > 0n)
          expect(reaches(curve, need - 1n, cents), `${cents} cents`).toBe(
            false,
          );
      }),
    );
  });

  it('is zero when a new wallet already covers the amount', () => {
    expect(creditNeeded(ARBITRUM, 25_600n)).toBe(0n);
    expect(creditNeeded(ARBITRUM, 1n)).toBe(0n);
    expect(creditNeeded(BASE_ONE, 10_000n)).toBe(0n);
    expect(creditNeeded(BASE_ONE, 10_001n)).toBe(50n);
    expect(creditNeeded(ARBITRUM, 225_601n)).toBe(1001n);
  });

  it('is null above the contract cap or when the curve never gets there', () => {
    expect(
      creditNeeded(ARBITRUM, LOCKAMOUNT_UPPERBOUND_TOKENS * 100n + 1n),
    ).toBeNull();
    expect(creditNeeded(ARBITRUM, LOCKAMOUNT_UPPERBOUND_TOKENS * 100n)).toBe(
      22_092_000n,
    );
    expect(
      creditNeeded({ base: 1n, maxLimit: 10n, magicValue: 1n }, 10_001n),
    ).toBeNull();
    expect(
      creditNeeded({ base: 1n, maxLimit: 1n, magicValue: 2n ** 250n }, 30_000n),
    ).toBeNull();
  });

  it('stops at the first credit where the replica is still defined', () => {
    // maxLimit · credit overflows uint256 from credit 2 on; credit 1 already reaches the cap.
    expect(creditNeeded({ ...ARBITRUM, maxLimit: 2n ** 255n }, 30_000n)).toBe(
      1n,
    );
  });
});

describe('contract mirrors', () => {
  it('computes the userRecord key as address << 12', () => {
    expect(castAddrToKey('0x0000000000000000000000000000000000000001')).toBe(
      4096n,
    );
    expect(castAddrToKey('0xffffffffffffffffffffffffffffffffffffffff')).toBe(
      (2n ** 160n - 1n) * 4096n,
    );
    expect(castAddrToKey('0xC40356e14842e951A2A1F156d5be28cC6E4C2697')).toBe(
      castAddrToKey('0xc40356e14842e951a2a1f156d5be28cc6e4c2697'),
    );
    expect(castAddrToKey('0xC40356e14842e951A2A1F156d5be28cC6E4C2697')).toBe(
      0xc40356e14842e951a2a1f156d5be28cc6e4c2697000n,
    );
  });

  it('floors userRecord wei to whole tokens like p2pix.sol:181', () => {
    expect(creditTokensFromWei(1_999_999_999_999_999_999n)).toBe(1n);
    expect(creditTokensFromWei(WAD - 1n)).toBe(0n);
    expect(creditTokensFromWei(0n)).toBe(0n);
    expect(creditTokensFromWei(1000n * WAD + 5n)).toBe(1000n);
  });

  it('clamps the limiter output to [100, 1,000,000]', () => {
    expect(
      [
        0n,
        1n,
        99n,
        100n,
        101n,
        999_999n,
        1_000_000n,
        1_000_001n,
        2n ** 200n,
      ].map(effectiveLimit),
    ).toEqual([
      100n,
      100n,
      100n,
      100n,
      101n,
      999_999n,
      1_000_000n,
      1_000_000n,
      1_000_000n,
    ]);
  });
});

describe('classifyAmount', () => {
  const at = (text: string, limitTokens: bigint): AmountVerdict => {
    const parsed = parseAmountInput(text);
    if (parsed.status !== 'ok') throw new Error(`not an amount: ${text}`);
    return classifyAmount(parsed.wei, limitTokens);
  };

  it('never checks amounts up to 100 (plan §2.7)', () => {
    expect(at('50', 100n)).toBe('free');
    expect(at('100', 100n)).toBe('free');
    expect(at('100,00', 2256n)).toBe('free');
    expect(at('100,01', 100n)).toBe('overLimit');
    expect(at('100,01', 2256n)).toBe('within');
  });

  it('lets an amount exactly at the limit through', () => {
    expect(at('2256', 2256n)).toBe('within');
    expect(at('2256,00', 2256n)).toBe('within');
    expect(at('2256,01', 2256n)).toBe('overLimit');
    expect(at('2256.01', 2256n)).toBe('overLimit');
  });

  it('reports the cap only when the cap is the binding bound', () => {
    expect(at('1.000.000', 1_000_000n)).toBe('within');
    expect(at('1000000,01', 1_000_000n)).toBe('overCap');
    expect(at('1000000,01', 2256n)).toBe('overLimit');
    expect(at('5.000.000', 999_999n)).toBe('overLimit');
  });

  it('gives BASE 1 wallets with credit below 50 the 100 bypass, and 101 at credit 50', () => {
    expect(limitAt(BASE_ONE, 0n)).toBe(100n);
    expect(limitAt(BASE_ONE, 49n)).toBe(100n);
    expect(limitAt(BASE_ONE, 50n)).toBe(101n);
    expect(at('101', limitAt(BASE_ONE, 49n))).toBe('overLimit');
    expect(at('101', limitAt(BASE_ONE, 50n))).toBe('within');
  });

  it("matches lock()'s revert rule for raw limiter values", () => {
    const reverts = (amountWei: bigint, spendLimit: bigint) =>
      amountWei > REPUTATION_LOWERBOUND_TOKENS * WAD &&
      (amountWei > spendLimit * WAD ||
        amountWei > LOCKAMOUNT_UPPERBOUND_TOKENS * WAD);
    const spendLimits = [0n, 1n, 99n, 100n, 101n, 2256n, 999_999n, 10n ** 6n];
    const amounts = spendLimits
      .concat([10n ** 7n, 2n * 10n ** 6n])
      .flatMap((tokens) => [tokens * WAD - 1n, tokens * WAD, tokens * WAD + 1n])
      .filter((wei) => wei > 0n);
    spendLimits
      .concat([2n * 10n ** 6n])
      .forEach((spendLimit) =>
        amounts.forEach((wei) =>
          expect(
            ['overLimit', 'overCap'].includes(classifyAmount(wei, spendLimit)),
            `${wei} wei vs limiter ${spendLimit}`,
          ).toBe(reverts(wei, spendLimit)),
        ),
      );
  });
});

describe('limitRowVariant', () => {
  it('shows a row only when over, and R3 wins after a refusal', () => {
    expect(limitRowVariant(null, false)).toBeNull();
    expect(limitRowVariant(null, true)).toBeNull();
    expect(limitRowVariant('free', true)).toBeNull();
    expect(limitRowVariant('within', true)).toBeNull();
    expect(limitRowVariant('overLimit', false)).toBe('over');
    expect(limitRowVariant('overCap', false)).toBe('cap');
    expect(limitRowVariant('overLimit', true)).toBe('refused');
    expect(limitRowVariant('overCap', true)).toBe('refused');
  });
});

describe('maxFill', () => {
  it('fills the binding bound: the limit, or a smaller offer', () => {
    expect(maxFill(2256n, null)).toEqual({ cents: 225_600n, binding: 'limit' });
    expect(maxFill(2256n, 500_000n)).toEqual({
      cents: 225_600n,
      binding: 'limit',
    });
    expect(maxFill(2256n, 225_600n)).toEqual({
      cents: 225_600n,
      binding: 'limit',
    });
    expect(maxFill(2256n, 150_050n)).toEqual({
      cents: 150_050n,
      binding: 'offer',
    });
    expect(maxFill(1_000_000n, null)).toEqual({
      cents: 100_000_000n,
      binding: 'limit',
    });
  });
});

describe('amount units', () => {
  it('compares in exactly the wei addLock sends: parseEther(String(value))', () => {
    const texts = [
      '0,01',
      '1',
      '100',
      '100,01',
      '2256',
      '2256,01',
      '2.256,01',
      '1500.5',
      '3000,50',
      '999.999,99',
      '1.000.000',
      '1000000,01',
    ];
    const sampled = Array.from(
      { length: 2000 },
      (_, i) => (splitmix(BigInt(i)) % 10_000_000_000n) + 1n,
    ).map(amountInputText);
    texts.concat(sampled).forEach((text) => {
      const parsed = parseAmountInput(text);
      if (parsed.status !== 'ok') throw new Error(`not an amount: ${text}`);
      expect(parsed.wei).toBe(centsToWei(parsed.cents));
      expect(parseEther(String(parsed.value)), text).toBe(parsed.wei);
    });
  });
});

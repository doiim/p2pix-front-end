import { describe, expect, it } from 'vitest';
import { CHART_NARROW, CHART_WIDE, buildLimitChart } from '@/utils/reputation';
import type {
  ChartInput,
  ChartLayout,
  GrowthChart,
  LimitChart,
  ReputationCurve,
} from '@/utils/reputation';

const ARBITRUM: ReputationCurve = {
  base: 256n,
  maxLimit: 1_000_000n,
  magicValue: 250_000_000_000n,
};
const BASE_ONE: ReputationCurve = { ...ARBITRUM, base: 1n };

const growth = (input: ChartInput, layout: ChartLayout): GrowthChart => {
  const chart = buildLimitChart(input, layout);
  if (chart.kind !== 'growth')
    throw new Error(`expected growth, got ${chart.kind}`);
  return chart;
};

// Projects a wide growth chart onto Main's `chart` keys (spec Appendix C).
const asMain = (chart: GrowthChart) => ({
  gridOpacity: chart.grid.labelVisible ? 1 : 0,
  youX: chart.you.x,
  youY: chart.you.y,
  goalX: chart.goal.x,
  goalY: chart.goal.y,
  leadTop: chart.labels?.leadTop,
  leadBot: chart.labels?.leadBottom,
  youLabelX: chart.labels?.you.x,
  youLabelY: chart.labels?.you.y,
  goalLabelX: chart.labels?.goal.x,
  goalLabelY: chart.labels?.goal.y,
  gridY: chart.grid.y,
  gridLabelY: chart.grid.labelY,
  gridLabel: chart.grid.label,
  zeroOpacity: chart.ticks.zero.visible ? 1 : 0,
  needOpacity: chart.ticks.need.visible ? 1 : 0,
  maxOpacity: chart.ticks.max.visible ? 1 : 0,
  xCredit: chart.ticks.credit.label,
  xNeed: chart.ticks.need.label,
  xMax_: chart.ticks.max.label,
  goalValue: `R$ ${chart.text.amount}`,
  faltam: chart.text.missing,
});

// Appendix C, minus Main's internal values (need, xMax, yMax, top), which the labels above carry.
const FIXTURES: [string, ChartInput, ReturnType<typeof asMain>][] = [
  [
    'P3 · Arbitrum, credit 1000, limit 2256, typed 3000',
    {
      curve: ARBITRUM,
      creditTokens: 1000n,
      limitTokens: 2256n,
      amountCents: 300_000n,
    },
    {
      gridOpacity: 1,
      youX: 155,
      youY: 87.3,
      goalX: 210.6,
      goalY: 66.6,
      leadTop: 61.3,
      leadBot: 80.3,
      youLabelX: 95,
      youLabelY: 43.3,
      goalLabelX: 219.6,
      goalLabelY: 83.6,
      gridY: 38.8,
      gridLabelY: 32.8,
      gridLabel: '4000',
      zeroOpacity: 1,
      needOpacity: 1,
      maxOpacity: 1,
      xCredit: '1000',
      xNeed: '1373',
      xMax_: '2000',
      goalValue: 'R$ 3000',
      faltam: '373',
    },
  ],
  [
    'P5 · Arbitrum, credit 0, limit 256, typed 400',
    {
      curve: ARBITRUM,
      creditTokens: 0n,
      limitTokens: 256n,
      amountCents: 40_000n,
    },
    {
      gridOpacity: 1,
      youX: 6,
      youY: 95.5,
      goalX: 149,
      goalY: 64.9,
      leadTop: 69.5,
      leadBot: 88.5,
      youLabelX: 4,
      youLabelY: 51.5,
      goalLabelX: 158,
      goalLabelY: 81.9,
      gridY: 43.7,
      gridLabelY: 37.7,
      gridLabel: '500',
      zeroOpacity: 0,
      needOpacity: 1,
      maxOpacity: 1,
      xCredit: '0',
      xNeed: '72',
      xMax_: '150',
      goalValue: 'R$ 400',
      faltam: '72',
    },
  ],
  [
    'P6 · Sepolia (BASE 1), credit 0, limit 100, typed 150',
    {
      curve: BASE_ONE,
      creditTokens: 0n,
      limitTokens: 100n,
      amountCents: 15_000n,
    },
    {
      gridOpacity: 1,
      youX: 6,
      youY: 110.7,
      goalX: 155,
      goalY: 90.7,
      leadTop: 84.7,
      leadBot: 103.7,
      youLabelX: 4,
      youLabelY: 66.7,
      goalLabelX: 164,
      goalLabelY: 107.7,
      gridY: 32.1,
      gridLabelY: 26.1,
      gridLabel: '300',
      zeroOpacity: 0,
      needOpacity: 1,
      maxOpacity: 1,
      xCredit: '0',
      xNeed: '75',
      xMax_: '150',
      goalValue: 'R$ 150',
      faltam: '75',
    },
  ],
  [
    'P9 · Arbitrum, credit 500, limit 1256, typed 3000',
    {
      curve: ARBITRUM,
      creditTokens: 500n,
      limitTokens: 1256n,
      amountCents: 300_000n,
    },
    {
      gridOpacity: 1,
      youX: 80.5,
      youY: 115.1,
      goalX: 210.6,
      goalY: 66.6,
      leadTop: 89.1,
      leadBot: 108.1,
      youLabelX: 20.5,
      youLabelY: 71.1,
      goalLabelX: 219.6,
      goalLabelY: 83.6,
      gridY: 38.8,
      gridLabelY: 32.8,
      gridLabel: '4000',
      zeroOpacity: 1,
      needOpacity: 1,
      maxOpacity: 1,
      xCredit: '500',
      xNeed: '1373',
      xMax_: '2000',
      goalValue: 'R$ 3000',
      faltam: '873',
    },
  ],
  [
    'Edge · Arbitrum, credit 1000, typed 2256,01',
    {
      curve: ARBITRUM,
      creditTokens: 1000n,
      limitTokens: 2256n,
      amountCents: 225_601n,
    },
    {
      gridOpacity: 1,
      youX: 204.7,
      youY: 68,
      goalX: 204.9,
      goalY: 68,
      leadTop: 42,
      leadBot: 61,
      youLabelX: 144.7,
      youLabelY: 24,
      goalLabelX: 213.9,
      goalLabelY: 85,
      gridY: 41,
      gridLabelY: 35,
      gridLabel: '3000',
      zeroOpacity: 1,
      needOpacity: 0,
      maxOpacity: 1,
      xCredit: '1000',
      xNeed: '1001',
      xMax_: '1500',
      goalValue: 'R$ 2256,01',
      faltam: '1',
    },
  ],
  [
    'Edge · Arbitrum, credit 1000, typed 10000 (grouped grid label)',
    {
      curve: ARBITRUM,
      creditTokens: 1000n,
      limitTokens: 2256n,
      amountCents: 1_000_000n,
    },
    {
      gridOpacity: 1,
      youX: 43.3,
      youY: 133.6,
      goalX: 187.5,
      goalY: 77.2,
      leadTop: 107.6,
      leadBot: 126.6,
      youLabelX: 4,
      youLabelY: 89.6,
      goalLabelX: 196.5,
      goalLabelY: 94.2,
      gridY: 40.9,
      gridLabelY: 34.9,
      gridLabel: '15.000',
      zeroOpacity: 1,
      needOpacity: 1,
      maxOpacity: 1,
      xCredit: '1000',
      xNeed: '4873',
      xMax_: '8000',
      goalValue: 'R$ 10.000',
      faltam: '3873',
    },
  ],
  [
    'Edge · Arbitrum, credit 1000, typed 999999 (grid label hidden by collision)',
    {
      curve: ARBITRUM,
      creditTokens: 1000n,
      limitTokens: 2256n,
      amountCents: 99_999_900n,
    },
    {
      gridOpacity: 0,
      youX: 6,
      youY: 149.7,
      goalX: 170.3,
      goalY: 31.7,
      leadTop: 42,
      leadBot: 142.7,
      youLabelX: 4,
      youLabelY: 24,
      goalLabelX: 179.3,
      goalLabelY: 48.7,
      gridY: 31.7,
      gridLabelY: 25.7,
      gridLabel: '1.000.000',
      zeroOpacity: 0,
      needOpacity: 1,
      maxOpacity: 1,
      xCredit: '1000',
      xNeed: '22.048.807',
      xMax_: '40.000.000',
      goalValue: 'R$ 999.999',
      faltam: '22.047.807',
    },
  ],
];

const P3: ChartInput = FIXTURES[0][1];

describe('growth chart (Main renderVals)', () => {
  it.each(FIXTURES)('%s matches Appendix C', (_, input, expected) => {
    expect(asMain(growth(input, CHART_WIDE))).toEqual(expected);
  });

  it('draws the P3 curve and highlight exactly as Main', () => {
    const chart = growth(P3, CHART_WIDE);
    expect(chart.curvePath).toBe(
      'M6 142.9 L6.1 142.8 L6.4 142.7 L7.2 142.4 L8.1 142.1 L9.3 141.7 L10.6 141.2 L12.4 140.5 L14.3 139.8 L16.4 139 L19 138 L21.6 137 L24.6 135.9 L27.9 134.7 L31.3 133.4 L35.1 132 L39.1 130.5 L43.4 128.9 L47.9 127.3 L52.6 125.5 L57.7 123.6 L63.1 121.6 L68.6 119.5 L74.4 117.4 L80.5 115.1 L86.9 112.7 L93.5 110.3 L100.3 107.7 L107.5 105 L114.8 102.3 L122.4 99.5 L130.3 96.5 L138.5 93.5 L146.8 90.4 L155.4 87.2 L164.4 83.8 L173.6 80.4 L183 76.9 L192.7 73.3 L202.7 69.5 L213 65.7 L223.4 61.8 L234.1 57.8 L245.1 53.7 L256.5 49.5 L267.9 45.2 L279.7 40.8 L291.8 36.3 L304 31.7',
    );
    expect(chart.highlightPath).toBe(
      'M155 87.3 L155.1 87.3 L155.9 87 L156.9 86.6 L158.4 86 L160.4 85.3 L162.7 84.4 L165.6 83.4 L168.9 82.2 L172.6 80.8 L176.8 79.2 L181.2 77.5 L186.3 75.7 L191.7 73.7 L197.6 71.4 L203.9 69.1 L210.6 66.6',
    );
  });

  it('places the wide plot box and tick anchors', () => {
    const chart = growth(P3, CHART_WIDE);
    expect([
      chart.width,
      chart.height,
      chart.plotLeft,
      chart.plotRight,
    ]).toEqual([310, 176, 6, 304]);
    expect([chart.baselineY, chart.tickY]).toEqual([150, 168]);
    expect(chart.ticks.zero).toMatchObject({
      x: 6,
      label: '0',
      anchor: 'start',
    });
    expect(chart.ticks.credit).toMatchObject({
      x: 155,
      anchor: 'middle',
      visible: true,
    });
    expect(chart.ticks.need).toMatchObject({ x: 210.6, anchor: 'middle' });
    expect(chart.ticks.max).toMatchObject({ x: 304, anchor: 'end' });
  });

  it('carries the aria and footer text (spec §10.3 mock)', () => {
    expect(growth(P3, CHART_WIDE).text).toEqual({
      credit: '1000',
      limit: '2256',
      amount: '3000',
      need: '1373',
      missing: '373',
      flatUntil: null,
    });
  });

  it('reports the flat stretch of BASE 1 curves only while the wallet is in it (spec §10.7)', () => {
    expect(growth(FIXTURES[2][1], CHART_WIDE).text.flatUntil).toBe('49');
    expect(
      growth(
        {
          curve: BASE_ONE,
          creditTokens: 49n,
          limitTokens: 100n,
          amountCents: 15_000n,
        },
        CHART_WIDE,
      ).text.flatUntil,
    ).toBe('49');
    expect(
      growth(
        {
          curve: BASE_ONE,
          creditTokens: 60n,
          limitTokens: 121n,
          amountCents: 30_000n,
        },
        CHART_WIDE,
      ).text.flatUntil,
    ).toBeNull();
  });

  it('uses the on-chain limit for the "you" dot, not the replica', () => {
    const onChain = growth(P3, CHART_WIDE);
    const lower = growth({ ...P3, limitTokens: 2000n }, CHART_WIDE);
    expect(lower.you.x).toBe(onChain.you.x);
    expect(lower.you.y).toBeGreaterThan(onChain.you.y);
    expect(lower.text.limit).toBe('2000');
  });
});

describe('narrow layout (M6)', () => {
  it('drops the in-chart labels and keeps the grid label', () => {
    const chart = growth(FIXTURES[6][1], CHART_NARROW);
    expect(chart.labels).toBeNull();
    expect(chart.grid.labelVisible).toBe(true);
    expect(growth(FIXTURES[6][1], CHART_WIDE).grid.labelVisible).toBe(false);
  });

  it('generalises the plot box to the narrow size', () => {
    const chart = growth(P3, CHART_NARROW);
    expect([
      chart.width,
      chart.height,
      chart.plotLeft,
      chart.plotRight,
    ]).toEqual([206, 160, 6, 200]);
    expect([chart.baselineY, chart.tickY]).toEqual([134, 152]);
    expect(chart.ticks.max.x).toBe(200);
  });

  it('scales the tick-gap thresholds with the plot width', () => {
    const chart = growth(P3, CHART_NARROW);
    const gap = chart.ticks.need.x - chart.ticks.credit.x;
    // Main's fixed 42px would hide the need tick here; scaled it is 42 × 194/298.
    expect(gap).toBeLessThan(42);
    expect(gap).toBeGreaterThanOrEqual((42 * 194) / 298);
    expect(chart.ticks.need.visible).toBe(true);
    expect(chart.ticks.credit.visible).toBe(true);
  });

  it('keeps the same text as the wide chart', () => {
    expect(growth(P3, CHART_NARROW).text).toEqual(growth(P3, CHART_WIDE).text);
  });
});

describe('cap-reached log chart (Chart-States #3)', () => {
  const board: ChartInput = {
    curve: ARBITRUM,
    creditTokens: 22_092_000n,
    limitTokens: 1_000_000n,
    amountCents: 120_000_000n,
  };

  it('matches the board geometry', () => {
    const chart = buildLimitChart(board, CHART_WIDE);
    if (chart.kind !== 'capReached') throw new Error(chart.kind);
    expect([
      chart.plotLeft,
      chart.plotRight,
      chart.plotTop,
      chart.baselineY,
      chart.tickY,
    ]).toEqual([6, 304, 14, 150, 168]);
    expect(chart.decadeXs).toEqual([72.6, 139.1, 205.7, 272.2]);
    expect(chart.cap).toEqual({ y: 51.4, labelY: 45.4 });
    expect(chart.you).toEqual({ x: 295.2, y: 51.4 });
    expect(chart.goal).toEqual({ x: 295.2, y: 31.7 });
    expect(chart.labels).toEqual({
      goal: { x: 285.2, y: 27.7 },
      you: { x: 285.2, y: 88 },
    });
    expect(chart.ticks).toEqual([
      { x: 6, label: '1 mil', anchor: 'start', visible: true },
      { x: 72.6, label: '10 mil', anchor: 'middle', visible: true },
      { x: 139.1, label: '100 mil', anchor: 'middle', visible: true },
      { x: 205.7, label: '1 mi', anchor: 'middle', visible: true },
      { x: 272.2, label: '10 mi', anchor: 'middle', visible: false },
      { x: 304, label: '22,1 mi', anchor: 'end', visible: true },
    ]);
    expect(chart.text).toEqual({ credit: '22.092.000', amount: '1.200.000' });
  });

  it('samples 49 points of the curve, flat at the cap on the right', () => {
    const chart = buildLimitChart(board, CHART_WIDE);
    if (chart.kind !== 'capReached') throw new Error(chart.kind);
    const points = chart.curvePath.split(' L');
    expect(points).toHaveLength(49);
    expect(points[0]).toMatch(/^M6 /);
    expect(points.at(-1)).toBe('304 51.4');
  });

  it('drops the in-chart labels on narrow screens and re-checks tick collisions', () => {
    const chart = buildLimitChart(board, CHART_NARROW);
    if (chart.kind !== 'capReached') throw new Error(chart.kind);
    expect(chart.labels).toBeNull();
    const visible = chart.ticks.filter((tick) => tick.visible);
    visible.slice(1).forEach((tick, i) => {
      const box = (t: { x: number; label: string; anchor: string }) => {
        const width = 7.2 * t.label.length;
        if (t.anchor === 'start') return [t.x, t.x + width];
        return t.anchor === 'end'
          ? [t.x - width, t.x]
          : [t.x - width / 2, t.x + width / 2];
      };
      expect(box(tick)[0]).toBeGreaterThanOrEqual(box(visible[i])[1] + 4);
    });
  });
});

describe('which chart, if any (spec §10.5)', () => {
  const kind = (input: ChartInput) => buildLimitChart(input, CHART_WIDE).kind;

  it('draws nothing while the amount fits, including exactly at the limit', () => {
    expect(kind({ ...P3, amountCents: 225_600n })).toBe('none');
    expect(kind({ ...P3, amountCents: 10_000n })).toBe('none');
  });

  it('draws nothing without a verified curve', () => {
    expect(kind({ ...P3, curve: null })).toBe('none');
  });

  it('says no reputation buys more than the cap when the limit is below it', () => {
    expect(kind({ ...P3, amountCents: 100_000_001n })).toBe('beyondCap');
    expect(kind({ ...P3, curve: null, amountCents: 100_000_001n })).toBe(
      'beyondCap',
    );
  });

  it('draws the log chart only when the cap is the limit and the curve is known', () => {
    const atCap = {
      ...P3,
      creditTokens: 22_092_000n,
      limitTokens: 1_000_000n,
      amountCents: 120_000_000n,
    };
    expect(kind(atCap)).toBe('capReached');
    expect(kind({ ...atCap, curve: null })).toBe('beyondCap');
    expect(kind({ ...atCap, creditTokens: 0n })).toBe('beyondCap');
    expect(kind({ ...atCap, amountCents: 100_000_000n })).toBe('none');
  });

  it('draws nothing when the curve disagrees with the inputs', () => {
    expect(kind({ ...P3, creditTokens: 5000n })).toBe('none');
    expect(kind({ ...P3, curve: { ...ARBITRUM, magicValue: 0n } })).toBe(
      'none',
    );
    expect(
      kind({ ...P3, curve: { base: 1n, maxLimit: 10n, magicValue: 1n } }),
    ).toBe('none');
  });

  describe('on arbitrary curves and amounts', () => {
    const MASK = 2n ** 64n - 1n;
    const word = (i: number) =>
      (BigInt(i) * 0x9e3779b97f4a7c15n + 0x632be59bd9b4e019n) & MASK;
    const inputs: ChartInput[] = Array.from({ length: 1200 }, (_, i) => ({
      curve: [
        null,
        ARBITRUM,
        BASE_ONE,
        {
          base: word(i) % 1000n,
          maxLimit: word(i + 1) % 2n ** BigInt(i % 90),
          magicValue: word(i + 2) % 2n ** BigInt(i % 100),
        },
      ][i % 4],
      creditTokens: word(i + 3) % 10n ** BigInt(i % 10),
      limitTokens: [
        100n,
        256n,
        2256n,
        1_000_000n,
        100n + (word(i + 4) % 1_000_000n),
      ][i % 5],
      amountCents: word(i + 5) % 10n ** BigInt(5 + (i % 6)),
    }));
    const pairs = inputs.map((input) => ({
      wide: buildLimitChart(input, CHART_WIDE),
      narrow: buildLimitChart(input, CHART_NARROW),
    }));
    const charts = pairs.flatMap((pair) => [pair.wide, pair.narrow]);

    it('produces every kind', () => {
      expect(new Set(charts.map((chart) => chart.kind))).toEqual(
        new Set(['growth', 'capReached', 'beyondCap', 'none']),
      );
    });

    it('picks the same kind and text for both layouts; only geometry differs', () => {
      pairs.forEach((pair) => {
        expect(pair.narrow.kind).toBe(pair.wide.kind);
        if (pair.wide.kind === 'growth' && pair.narrow.kind === 'growth')
          expect(pair.narrow.text).toEqual(pair.wide.text);
        if (
          pair.wide.kind === 'capReached' &&
          pair.narrow.kind === 'capReached'
        )
          expect(pair.narrow.text).toEqual(pair.wide.text);
      });
    });

    it('never throws or yields a non-finite coordinate', () => {
      const numbers = (chart: LimitChart): number[] => {
        if (chart.kind === 'growth')
          return [
            chart.you.x,
            chart.you.y,
            chart.goal.x,
            chart.goal.y,
            chart.grid.y,
            chart.grid.labelY,
          ];
        if (chart.kind === 'capReached')
          return [
            chart.you.x,
            chart.you.y,
            chart.goal.y,
            chart.cap.y,
            ...chart.decadeXs,
          ];
        return [];
      };
      charts.forEach((chart) =>
        numbers(chart).forEach((n) => expect(Number.isFinite(n)).toBe(true)),
      );
      charts
        .filter(
          (chart) => chart.kind === 'growth' || chart.kind === 'capReached',
        )
        .forEach((chart) =>
          expect(chart.curvePath).not.toMatch(/NaN|Infinity/),
        );
    });
  });
});

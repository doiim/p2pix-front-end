import type { Address } from 'viem';

// Mirrors p2pix-smart-contracts/contracts/core/Constants.sol (internal constants, no getter).
/** @public */
export const WAD = 10n ** 18n;
export const REPUTATION_LOWERBOUND_TOKENS = 100n;
export const LOCKAMOUNT_UPPERBOUND_TOKENS = 1_000_000n;

// Every configured token has 18 decimals, and addLock converts with parseEther. A token with other
// decimals needs this conversion and addLock (src/blockchain/buyerMethods.ts) changed together.
const WEI_PER_CENT = 10n ** 16n;

export type ReputationErrorKind = 'rpc' | 'module';

export type ReputationTarget = {
  chainId: number;
  p2pix: Address;
  account: Address; // effective address: Kernel on the AA rail, EOA otherwise
};

export type ReputationCurve = {
  base: bigint; // raw limiter(0)
  maxLimit: bigint; // Reputation.maxLimit()
  magicValue: bigint; // Reputation.magicValue()
};

export type ReputationSnapshot = {
  chainId: number;
  p2pix: Address; // checksummed
  account: Address; // checksummed
  blockNumber: bigint; // every read below is pinned to this block
  key: bigint; // castAddrToKey(account)
  reputation: Address; // P2PIX.reputation() at blockNumber, checksummed
  creditTokens: bigint; // userRecord(key) / WAD, floored
  limiterValue: bigint; // raw limiter(creditTokens)
  limitTokens: bigint; // effectiveLimit(limiterValue)
  baseValue: bigint; // raw limiter(0)
  newWalletLimitTokens: bigint; // effectiveLimit(baseValue)
  nextLimitTokens: bigint | null; // effectiveLimit(limiter(creditTokens + limitTokens)); null at the cap or when that read failed
  curve: ReputationCurve | null; // null when the maxLimit or magicValue read failed
};

export type ReputationRead =
  | { ok: true; snapshot: ReputationSnapshot }
  | {
      ok: false;
      reason: 'disconnected' | 'stale' | 'timeout' | ReputationErrorKind;
    };

export type AmountVerdict = 'free' | 'within' | 'overLimit' | 'overCap';
export type LimitRowVariant = 'over' | 'cap' | 'refused'; // R1 | R2 | R3
// The row's lead sentence (spec §6), followed by "R$ {limit}"; the search step announces the same words.
export const LIMIT_ROW_SENTENCES: Record<LimitRowVariant, string> = {
  over: 'Acima do seu limite de',
  cap: 'Acima do limite máximo de',
  refused: 'O contrato recusou esta compra: seu limite atual é de',
};
export type PanelTag = 'chart' | 'howItWorks' | 'verification';
export type AccountKind = 'wallet' | 'smartAccount';
// A "Confirmar Oferta" press (BSC → HV); HV hands it back as the refusal after AmountNotAllowed.
export type BuyPress = {
  amount: number;
  skipAllowlist?: boolean; // "Comprar sem a lista": lock without the seller's allowlist proof
  checkedWithin: boolean; // a limit read said the amount fits: only then is P9 ("Seu limite mudou…") true
};
export type LimitChange = {
  networkName: string;
  beforeTokens: bigint;
  afterTokens: bigint;
}; // HV → BCC (D7)
export type MaxFill = { cents: bigint; binding: 'limit' | 'offer' };

export type ParsedAmount =
  | { status: 'empty' } // '', whitespace, zero, or not a number (Main parse → 0)
  | { status: 'tooManyDecimals'; displayCents: bigint } // > 2 significant decimals; cents rounded half-up, for the "~ R$" row only
  | { status: 'ok'; cents: bigint; wei: bigint; value: number }; // wei = cents * 10n ** 16n; value = Number(normalised)

// Contract mirrors

export const castAddrToKey = (account: Address): bigint =>
  BigInt(account) << 12n;

export const creditTokensFromWei = (creditWei: bigint): bigint =>
  creditWei / WAD;

export const effectiveLimit = (limiterValue: bigint): bigint => {
  if (limiterValue < REPUTATION_LOWERBOUND_TOKENS)
    return REPUTATION_LOWERBOUND_TOKENS;
  return limiterValue > LOCKAMOUNT_UPPERBOUND_TOKENS
    ? LOCKAMOUNT_UPPERBOUND_TOKENS
    : limiterValue;
};

// The chart's curve from the module's own parameters; a failed maxLimit/magicValue read draws no chart.
export const readCurve = (
  base: bigint,
  maxLimit: bigint | undefined,
  magicValue: bigint | undefined,
): ReputationCurve | null =>
  maxLimit === undefined || magicValue === undefined
    ? null
    : { base, maxLimit, magicValue };

// The chart's limit at a credit, in float: limit(c) = base + maxLimit·c / √(magicValue + c²), clamped
// like the contract's. Display only; within one token of the contract's integer arithmetic.
const limitAt = (curve: ReputationCurve, credit: number): number => {
  const raw =
    Number(curve.base) +
    (Number(curve.maxLimit) * credit) /
      Math.sqrt(Number(curve.magicValue) + credit * credit);
  return Math.min(
    Math.max(raw, Number(REPUTATION_LOWERBOUND_TOKENS)),
    Number(LOCKAMOUNT_UPPERBOUND_TOKENS),
  );
};

// Credit at which the limit reaches the amount, from the closed-form inverse of limitAt: with
// k = limit − base, c = √magicValue·k / √(maxLimit² − k²). Null above the cap.
/** @public */
export const creditNeeded = (
  curve: ReputationCurve,
  amountCents: bigint,
): bigint | null => {
  if (amountCents > LOCKAMOUNT_UPPERBOUND_TOKENS * 100n) return null;
  const amount = Number(amountCents) / 100;
  if (amount <= limitAt(curve, 0)) return 0n;
  const k = amount - Number(curve.base);
  const maxLimit = Number(curve.maxLimit);
  if (k >= maxLimit) return null;
  return BigInt(
    Math.ceil(
      (Math.sqrt(Number(curve.magicValue)) * k) /
        Math.sqrt(maxLimit * maxLimit - k * k),
    ),
  );
};

// lock() reverts iff amount > 100e18 && (amount > limiter·WAD || amount > 1e24); clamping to the
// effective limit makes this exact for raw limiter values too.
export const classifyAmount = (
  amountWei: bigint,
  limitTokens: bigint,
): AmountVerdict => {
  if (amountWei <= REPUTATION_LOWERBOUND_TOKENS * WAD) return 'free';
  const limit = effectiveLimit(limitTokens);
  if (amountWei <= limit * WAD) return 'within';
  return limit === LOCKAMOUNT_UPPERBOUND_TOKENS ? 'overCap' : 'overLimit';
};

export const limitRowVariant = (
  verdict: AmountVerdict | null,
  refused: boolean,
): LimitRowVariant | null => {
  if (verdict !== 'overLimit' && verdict !== 'overCap') return null;
  if (refused) return 'refused';
  return verdict === 'overCap' ? 'cap' : 'over';
};

export const maxFill = (
  limitTokens: bigint,
  maxOfferCents: bigint | null,
): MaxFill =>
  maxOfferCents !== null && maxOfferCents < limitTokens * 100n
    ? { cents: maxOfferCents, binding: 'offer' }
    : { cents: limitTokens * 100n, binding: 'limit' };

// pt-BR input and formatting (spec §3, Main verbatim semantics on bigint cents)

export const parseAmountInput = (text: string): ParsedAmount => {
  const compact = text.replace(/\s/g, '');
  const normalised = compact.includes(',')
    ? compact.replace(/\./g, '').replace(',', '.')
    : DOT_THOUSANDS.test(compact)
      ? compact.replace(/\./g, '')
      : compact;
  const value = Number(normalised);
  // Like Main's parse, digit strings past Number's range (value Infinity) count as empty.
  if (
    !PLAIN_DECIMAL.test(normalised) ||
    /^[0.]*$/.test(normalised) ||
    !Number.isFinite(value)
  )
    return { status: 'empty' };
  const dot = normalised.indexOf('.');
  const integerDigits = dot === -1 ? normalised : normalised.slice(0, dot);
  const decimals =
    dot === -1 ? '' : normalised.slice(dot + 1).replace(/0+$/, '');
  const cents =
    BigInt(`0${integerDigits}`) * 100n +
    BigInt(decimals.slice(0, 2).padEnd(2, '0'));
  if (decimals.length > 2)
    return {
      status: 'tooManyDecimals',
      displayCents: cents + (Number(decimals.charAt(2)) >= 5 ? 1n : 0n),
    };
  return {
    status: 'ok',
    cents,
    wei: cents * WEI_PER_CENT,
    value,
  };
};

export const amountInputText = (cents: bigint): string =>
  BRL_INPUT.format(Number(cents) / 100);

export const floorCents = (value: number): bigint => {
  if (!Number.isFinite(value) || value <= 0) return 0n;
  const digits = /^(\d+)(?:\.(\d+))?$/.exec(String(value));
  // String(value) switches to exponent form below 1e-6 and from 1e21 on.
  if (digits === null)
    return value >= 1e21 ? BigInt(Math.trunc(value)) * 100n : 0n;
  return (
    BigInt(digits[1]) * 100n +
    BigInt((digits[2] ?? '').slice(0, 2).padEnd(2, '0'))
  );
};

export const formatBrl = (cents: bigint): string =>
  BRL.format(Number(cents) / 100);

export const formatBrlFixed = (cents: bigint): string =>
  BRL_FIXED.format(Number(cents) / 100);

export const formatTokens = (tokens: bigint): string =>
  formatBrl(tokens * 100n);

export const castCommands = (snapshot: ReputationSnapshot): string => {
  const pinned = `--block ${snapshot.blockNumber} --rpc-url <SEU_RPC>`;
  return [
    `cast call ${snapshot.p2pix} "_castAddrToKey(address)(uint256)" ${snapshot.account} --rpc-url <SEU_RPC>`,
    `cast call ${snapshot.p2pix} "userRecord(uint256)(uint256)" ${snapshot.key} ${pinned}`,
    `cast call ${snapshot.p2pix} "reputation()(address)" ${pinned}`,
    `cast call ${snapshot.reputation} "limiter(uint256)(uint256)" ${snapshot.creditTokens} ${pinned}`,
  ].join('\n');
};

// Chart geometry (plain data for an SVG; spec §10)

export type ChartLayout = {
  width: number;
  height: number;
  inChartLabels: boolean;
};
export const CHART_WIDE: ChartLayout = {
  width: 310,
  height: 176,
  inChartLabels: true,
};
export const CHART_NARROW: ChartLayout = {
  width: 206,
  height: 160,
  inChartLabels: false,
};

export type ChartInput = {
  curve: ReputationCurve | null;
  creditTokens: bigint;
  limitTokens: bigint;
  amountCents: bigint;
};
export type ChartPoint = { x: number; y: number };
type LabelSpot = ChartPoint & { anchor: 'start' | 'end' };
export type ChartTick = {
  x: number;
  label: string;
  anchor: 'start' | 'middle' | 'end';
  visible: boolean;
};

export type GrowthChart = {
  kind: 'growth';
  width: number;
  height: number;
  plotLeft: number; // 6
  plotRight: number; // width - 6
  plotTop: number; // 14
  baselineY: number; // height - 26
  tickY: number; // height - 8
  curvePath: string; // the whole curve, log credit × log limit
  highlightPath: string; // the stretch from your credit to the credit needed
  decadeXs: number[]; // vertical gridlines at each 10^k strictly inside the credit axis
  cap: { y: number; labelY: number }; // line at Y(1e6), like CapChart
  you: ChartPoint; // y uses the on-chain limit
  goal: ChartPoint;
  labels: { you: LabelSpot; goal: LabelSpot } | null; // wide only, and only where they fit
  ticks: ChartTick[]; // decades of credit; colliding ones have visible=false
  text: {
    credit: string;
    limit: string;
    amount: string;
    need: string;
    missing: string;
    flatUntil: string | null;
  }; // formatBrl strings, no "R$"
};

export type CapChart = {
  kind: 'capReached';
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number; // 14
  baselineY: number;
  tickY: number;
  curvePath: string;
  decadeXs: number[]; // vertical gridlines at each 10^k strictly inside (xMin, xMax)
  cap: { y: number; labelY: number }; // line at Y(1e6); label "Teto do contrato · 1.000.000" at (plotLeft, labelY)
  you: ChartPoint; // (X(credit), Y(1e6))
  goal: ChartPoint; // (X(credit), Y(amount))
  labels: { you: ChartPoint; goal: ChartPoint } | null; // end-anchored text origins; wide only
  ticks: ChartTick[]; // "1 mil" start, decades middle, compact(credit) end; colliding ones have visible=false
  text: { credit: string; amount: string }; // formatBrl strings
};

export type LimitChart =
  | GrowthChart
  | CapChart
  | { kind: 'beyondCap' }
  | { kind: 'none' };

export const buildLimitChart = (
  input: ChartInput,
  layout: ChartLayout,
): LimitChart => {
  if (input.amountCents <= input.limitTokens * 100n) return { kind: 'none' };
  if (input.amountCents > LOCKAMOUNT_UPPERBOUND_TOKENS * 100n)
    return input.limitTokens === LOCKAMOUNT_UPPERBOUND_TOKENS &&
      input.curve !== null &&
      input.creditTokens > 0n
      ? capChart(input.curve, input, layout)
      : { kind: 'beyondCap' };
  return input.curve === null
    ? { kind: 'none' }
    : growthChart(input.curve, input, layout);
};

// Supporting detail

// Dot-grouped thousands with a non-zero first group, so "0.500" stays 0,5 (spec A6).
const DOT_THOUSANDS = /^[1-9]\d{0,2}(\.\d{3})+$/;
const PLAIN_DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

// pt-BR money: groups only from five integer digits ("2000", "10.000"); trailing fraction zeros dropped
// except in the fixed form. The input form is the same number without groups, not the display minus dots.
const BRL = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  useGrouping: 'min2',
});
const BRL_FIXED = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  useGrouping: 'min2',
});
const BRL_INPUT = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
  useGrouping: false,
});

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
const decadeBelow = (v: number) => Math.pow(10, Math.floor(Math.log10(v)));
const niceCeil = (v: number) =>
  (NICE_STEPS.find((step) => step * decadeBelow(v) >= v) ?? 10) *
  decadeBelow(v);
const r1 = (n: number) => Math.round(n * 10) / 10;
const compactNumber = (n: number): string => {
  const oneDecimal = (v: number) =>
    String(Math.round(v * 10) / 10).replace('.', ',');
  if (n >= 1e6) return `${oneDecimal(n / 1e6)} mi`;
  return n >= 1e3 ? `${oneDecimal(n / 1e3)} mil` : oneDecimal(n);
};

// Log credit × log limit over the curve's whole range, so the floor, the climb and the 1,000,000 cap
// all show: on a linear axis near your credit the curve is base + 2c, a straight line.
const growthChart = (
  curve: ReputationCurve,
  input: ChartInput,
  layout: ChartLayout,
): GrowthChart | { kind: 'none' } => {
  const needTokens = creditNeeded(curve, input.amountCents);
  if (needTokens === null || needTokens <= input.creditTokens)
    return { kind: 'none' };
  const eff = (credit: number) => limitAt(curve, credit);
  const plotLeft = 6;
  const plotRight = layout.width - 6;
  const plotTop = 14;
  const baselineY = layout.height - 26;
  const credit = Number(input.creditTokens);
  const need = Number(needTokens);
  const cap = Number(LOCKAMOUNT_UPPERBOUND_TOKENS);
  const logMin = 1;
  const logMax = Math.max(7, Math.ceil(Math.log10(need * 2)));
  const yLogMin = Math.log10(Number(REPUTATION_LOWERBOUND_TOKENS));
  const yLogMax = Math.log10(cap * 1.6);
  // Credit below 10 (a new wallet's 0) sits on the left edge, where the curve is still flat.
  const X = (c: number) =>
    plotLeft +
    ((plotRight - plotLeft) * (Math.log10(Math.max(c, 10)) - logMin)) /
      (logMax - logMin);
  const Y = (limit: number) =>
    baselineY -
    ((baselineY - plotTop) * (Math.log10(limit) - yLogMin)) /
      (yLogMax - yLogMin);
  const logSpace = (from: number, to: number, count: number) =>
    Array.from({ length: count }, (_, i) =>
      Math.pow(10, from + ((to - from) * i) / (count - 1)),
    );
  const path = (credits: number[]) =>
    credits
      .map((c, i) => `${i ? ' L' : 'M'}${r1(X(c))} ${r1(Y(eff(c)))}`)
      .join('');
  const youX = r1(X(credit));
  const youY = r1(Y(Number(input.limitTokens)));
  const goalX = r1(X(need));
  const goalY = r1(Y(eff(need)));
  const flatEnd =
    curve.base < REPUTATION_LOWERBOUND_TOKENS
      ? creditNeeded(curve, REPUTATION_LOWERBOUND_TOKENS * 100n + 1n)
      : null;
  return {
    kind: 'growth',
    width: layout.width,
    height: layout.height,
    plotLeft,
    plotRight,
    plotTop,
    baselineY,
    tickY: layout.height - 8,
    curvePath: path(logSpace(logMin, logMax, 97)),
    highlightPath: path(
      logSpace(Math.log10(Math.max(credit, 10)), Math.log10(need), 17),
    ),
    decadeXs: logSpace(logMin + 1, logMax - 1, logMax - logMin - 1).map((c) =>
      r1(X(c)),
    ),
    cap: { y: r1(Y(cap)), labelY: r1(Y(cap) - 6) },
    you: { x: youX, y: youY },
    goal: { x: goalX, y: goalY },
    labels: layout.inChartLabels
      ? growthLabels(
          { x: youX, y: youY },
          { x: goalX, y: goalY },
          {
            left: plotLeft,
            right: plotRight,
            top: r1(Y(cap)) + 2, // below the cap line's label
            bottom: baselineY - 2,
          },
        )
      : null,
    ticks: logTicks(
      logSpace(logMin, logMax, logMax - logMin + 1).map((c) => ({
        x: r1(X(c)),
        label: compactNumber(c),
      })),
    ),
    text: {
      credit: formatTokens(input.creditTokens),
      limit: formatTokens(input.limitTokens),
      amount: formatBrl(input.amountCents),
      need: formatTokens(needTokens),
      missing: formatTokens(needTokens - input.creditTokens),
      flatUntil:
        flatEnd !== null && input.creditTokens < flatEnd
          ? formatTokens(flatEnd - 1n)
          : null,
    },
  };
};

// "Você está aqui" goes above-left of its dot (empty above a rising curve), or above it at the left
// edge; "Para comprar" goes below-right of its dot. Null, so the legend shows, when either would leave
// the plot or the two would overlap.
const growthLabels = (
  you: ChartPoint,
  goal: ChartPoint,
  plot: { left: number; right: number; top: number; bottom: number },
): { you: LabelSpot; goal: LabelSpot } | null => {
  const youSpot: LabelSpot =
    you.x - 100 >= plot.left
      ? { x: r1(you.x - 9), y: r1(you.y - 20), anchor: 'end' }
      : { x: plot.left, y: r1(you.y - 34), anchor: 'start' };
  const goalSpot: LabelSpot = {
    x: r1(goal.x + 9),
    y: r1(goal.y + 17),
    anchor: 'start',
  };
  // Two lines of text-xs: about 10px above the first baseline, 18px below it.
  const box = (spot: LabelSpot, width: number) => {
    const left = spot.anchor === 'start' ? spot.x : spot.x - width;
    return { left, right: left + width, top: spot.y - 10, bottom: spot.y + 18 };
  };
  const boxes = [box(youSpot, 92), box(goalSpot, 84)];
  const inside = boxes.every(
    (b) =>
      b.left >= plot.left - 4 &&
      b.right <= plot.right + 4 &&
      b.top >= plot.top &&
      b.bottom <= plot.bottom,
  );
  const overlap =
    boxes[0].left < boxes[1].right &&
    boxes[1].left < boxes[0].right &&
    boxes[0].top < boxes[1].bottom &&
    boxes[1].top < boxes[0].bottom;
  return inside && !overlap ? { you: youSpot, goal: goalSpot } : null;
};

// First label start-anchored, last end-anchored; a middle one is hidden when it would come within 4px
// of the last label or the previous visible one.
const logTicks = (
  points: readonly { x: number; label: string }[],
): ChartTick[] => {
  const labelWidth = (label: string) => 7.2 * label.length;
  const first = points[0];
  const last = points[points.length - 1];
  const endLeft = last.x - labelWidth(last.label);
  const middle = points
    .slice(1, -1)
    .reduce<{ ticks: ChartTick[]; right: number }>(
      (acc, point) => {
        const half = labelWidth(point.label) / 2;
        const visible =
          point.x - half >= acc.right + 4 && point.x + half + 4 <= endLeft;
        return {
          ticks: [...acc.ticks, { ...point, anchor: 'middle', visible }],
          right: visible ? point.x + half : acc.right,
        };
      },
      { ticks: [], right: first.x + labelWidth(first.label) },
    );
  return [
    { ...first, anchor: 'start', visible: true },
    ...middle.ticks,
    { ...last, anchor: 'end', visible: true },
  ];
};

// Cap-reached log chart (spec §10.6): log10 credit axis, linear limit axis up to amount × 1.15.
const capChart = (
  curve: ReputationCurve,
  input: ChartInput,
  layout: ChartLayout,
): CapChart => {
  const plotLeft = 6;
  const plotRight = layout.width - 6;
  const plotTop = 14;
  const baselineY = layout.height - 26;
  const credit = Number(input.creditTokens);
  const cap = Number(LOCKAMOUNT_UPPERBOUND_TOKENS);
  const xMax = niceCeil(credit * 1.3);
  const topExponent = Math.floor(Math.log10(xMax));
  const logMin = topExponent - 4;
  const logMax = Math.log10(xMax);
  const amount = Number(input.amountCents) / 100;
  const yMax = amount * 1.15;
  const X = (c: number) =>
    plotLeft +
    ((plotRight - plotLeft) * (Math.log10(c) - logMin)) / (logMax - logMin);
  const Y = (limit: number) =>
    baselineY - ((baselineY - plotTop) * limit) / yMax;
  const samples = Array.from({ length: 49 }, (_, i) =>
    Math.pow(10, logMin + ((logMax - logMin) * i) / 48),
  );
  const limits = samples.map((c) => limitAt(curve, c));
  const decades = Array.from({ length: 4 }, (_, i) =>
    Math.pow(10, logMin + 1 + i),
  ).filter((c) => c < xMax);
  const creditX = X(credit);
  return {
    kind: 'capReached',
    width: layout.width,
    height: layout.height,
    plotLeft,
    plotRight,
    plotTop,
    baselineY,
    tickY: layout.height - 8,
    curvePath: samples
      .map((c, i) => `${i ? ' L' : 'M'}${r1(X(c))} ${r1(Y(limits[i]))}`)
      .join(''),
    decadeXs: decades.map((c) => r1(X(c))),
    cap: { y: r1(Y(cap)), labelY: r1(Y(cap) - 6) },
    you: { x: r1(creditX), y: r1(Y(cap)) },
    goal: { x: r1(creditX), y: r1(Y(amount)) },
    labels: layout.inChartLabels
      ? {
          you: { x: r1(creditX - 10), y: r1(Y(cap) + 36.6) },
          goal: { x: r1(creditX - 10), y: r1(Y(amount) - 4) },
        }
      : null,
    ticks: logTicks([
      { x: plotLeft, label: compactNumber(Math.pow(10, logMin)) },
      ...decades.map((c) => ({ x: r1(X(c)), label: compactNumber(c) })),
      { x: plotRight, label: compactNumber(credit) },
    ]),
    text: {
      credit: formatTokens(input.creditTokens),
      amount: formatBrl(input.amountCents),
    },
  };
};

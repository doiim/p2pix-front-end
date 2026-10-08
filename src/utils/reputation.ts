import type { Address } from 'viem';

// Mirrors p2pix-smart-contracts/contracts/core/Constants.sol (internal constants, no getter; pinned by tests/reputation/constants.test.ts).
/** @public */
export const WAD = 10n ** 18n;
export const REPUTATION_LOWERBOUND_TOKENS = 100n;
export const LOCKAMOUNT_UPPERBOUND_TOKENS = 1_000_000n;

// Every configured token has 18 decimals, and addLock converts with parseEther. A token with other
// decimals needs this conversion and addLock (src/blockchain/buyerMethods.ts) changed together.
const WEI_PER_CENT = 10n ** 16n;
const MAX_UINT256 = 2n ** 256n - 1n;
// The replica squares the credit, so past 2^128 it overflows uint256 and Solidity would revert.
const CREDIT_SEARCH_CEILING = 2n ** 128n;

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
  curve: ReputationCurve | null; // non-null only when the replica reproduces every limiter value read above (D8)
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
  identification: string; // the CPF/CNPJ field, held in memory only, so the retry needs no retyping
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

// Literal port of Reputation.sol `sqrt` (Solmate FixedPointMathLib), stage by stage.
/** @public */
export const solmateSqrt = (x: bigint): bigint => {
  const estimate = SQRT_STAGES.reduce(
    (acc, [threshold, yShift, zShift]) =>
      acc.y >= threshold ? { y: acc.y >> yShift, z: acc.z << zShift } : acc,
    { y: x, z: 181n },
  );
  const z = Array.from({ length: 7 }).reduce<bigint>(
    (zz) => (zz + evmDiv(x, zz)) >> 1n,
    (estimate.z * (estimate.y + 65536n)) >> 18n,
  );
  return z - (evmDiv(x, z) < z ? 1n : 0n);
};

// Returns null wherever Solidity 0.8 would revert: uint256 overflow or a zero divisor.
export const limiterReplica = (
  curve: ReputationCurve,
  creditTokens: bigint,
): bigint | null => {
  const numerator = curve.maxLimit * creditTokens;
  const radicand = curve.magicValue + creditTokens * creditTokens;
  if (numerator > MAX_UINT256 || radicand > MAX_UINT256) return null;
  const root = solmateSqrt(radicand);
  if (root === 0n) return null;
  const value = curve.base + numerator / root;
  return value > MAX_UINT256 ? null : value;
};

/** @public */
export const creditNeeded = (
  curve: ReputationCurve,
  amountCents: bigint,
): bigint | null => {
  if (amountCents > LOCKAMOUNT_UPPERBOUND_TOKENS * 100n) return null;
  const reaches = (credit: bigint) => {
    const value = limiterReplica(curve, credit);
    return value === null ? null : effectiveLimit(value) * 100n >= amountCents;
  };
  const upperBound = (hi: bigint): bigint | null => {
    const hit = hi > CREDIT_SEARCH_CEILING ? null : reaches(hi);
    if (hit === null) return null;
    return hit ? hi : upperBound(hi * 2n);
  };
  const search = (lo: bigint, hi: bigint): bigint | null => {
    if (lo >= hi) return lo;
    const mid = (lo + hi) >> 1n;
    const hit = reaches(mid);
    if (hit === null) return null;
    return hit ? search(lo, mid) : search(mid + 1n, hi);
  };
  const hi = upperBound(1n);
  return hi === null ? null : search(0n, hi);
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

export const amountInputText = (cents: bigint): string => {
  const fraction = centsFraction(cents);
  return fraction === '00'
    ? String(cents / 100n)
    : `${cents / 100n},${fraction.replace(/0$/, '')}`;
};

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

/** @public */
export const groupThousands = (integer: bigint): string =>
  integer < 10000n
    ? String(integer)
    : String(integer).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

export const formatBrl = (cents: bigint): string => {
  if (cents < 0n) return `-${formatBrl(-cents)}`;
  const fraction = centsFraction(cents);
  const integer = groupThousands(cents / 100n);
  return fraction === '00'
    ? integer
    : `${integer},${fraction.replace(/0$/, '')}`;
};

export const formatBrlFixed = (cents: bigint): string =>
  cents < 0n
    ? `-${formatBrlFixed(-cents)}`
    : `${groupThousands(cents / 100n)},${centsFraction(cents)}`;

export const formatTokens = (tokens: bigint): string =>
  formatBrl(tokens * 100n);

export const shortWallet = (address: Address): string =>
  `${address.slice(0, 5)}...${address.slice(-4)}`;

export const shortContract = (address: Address): string =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

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
  baselineY: number; // height - 26
  tickY: number; // height - 8
  curvePath: string; // Main `curve`
  highlightPath: string; // Main `hl`
  you: ChartPoint; // Main youX, youY (y uses the on-chain limit)
  goal: ChartPoint; // Main goalX, goalY
  grid: { y: number; labelY: number; label: string; labelVisible: boolean }; // gridY, gridLabelY, gridLabel, gridOpacity === 1
  ticks: {
    zero: ChartTick;
    credit: ChartTick;
    need: ChartTick;
    max: ChartTick;
  };
  labels: {
    you: ChartPoint;
    goal: ChartPoint;
    leadTop: number;
    leadBottom: number;
  } | null; // wide only; null when !inChartLabels
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

// EVM `div` returns 0 on a zero divisor; bigint division would throw.
const evmDiv = (a: bigint, b: bigint) => (b === 0n ? 0n : a / b);

// [threshold, y shift, z shift] for the four `if iszero(lt(y, …))` branches of the Solmate sqrt.
const SQRT_STAGES = [
  [1n << 136n, 128n, 64n],
  [1n << 72n, 64n, 32n],
  [1n << 40n, 32n, 16n],
  [1n << 24n, 16n, 8n],
] as const;

// Dot-grouped thousands with a non-zero first group, so "0.500" stays 0,5 (spec A6).
const DOT_THOUSANDS = /^[1-9]\d{0,2}(\.\d{3})+$/;
const PLAIN_DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

const centsFraction = (cents: bigint) => String(cents % 100n).padStart(2, '0');

const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
const decadeBelow = (v: number) => Math.pow(10, Math.floor(Math.log10(v)));
const niceCeil = (v: number) =>
  (NICE_STEPS.find((step) => step * decadeBelow(v) >= v) ?? 10) *
  decadeBelow(v);
const niceFloor = (v: number) =>
  (NICE_STEPS.filter((step) => step * decadeBelow(v) <= v).at(-1) ?? 1) *
  decadeBelow(v);
const r1 = (n: number) => Math.round(n * 10) / 10;
const formatNumber = (n: number) => formatBrl(BigInt(Math.round(n * 100)));
const compactNumber = (n: number): string => {
  const oneDecimal = (v: number) =>
    String(Math.round(v * 10) / 10).replace('.', ',');
  if (n >= 1e6) return `${oneDecimal(n / 1e6)} mi`;
  return n >= 1e3 ? `${oneDecimal(n / 1e3)} mil` : oneDecimal(n);
};

// Effective limit at a credit given as a JS number (floored to whole tokens, as p2pix.sol floors
// credit); NaN where the replica is undefined.
const effectiveAt = (curve: ReputationCurve, credit: number): number => {
  const value =
    Number.isFinite(credit) && credit >= 0
      ? limiterReplica(curve, BigInt(Math.floor(credit)))
      : null;
  return value === null ? Number.NaN : Number(effectiveLimit(value));
};

// Port of Main `renderVals` (spec §10.2), parameterised by layout.
const growthChart = (
  curve: ReputationCurve,
  input: ChartInput,
  layout: ChartLayout,
): GrowthChart | { kind: 'none' } => {
  const needTokens = creditNeeded(curve, input.amountCents);
  if (needTokens === null || needTokens <= input.creditTokens)
    return { kind: 'none' };
  const eff = (credit: number) => effectiveAt(curve, credit);
  const plotLeft = 6;
  const plotRight = layout.width - 6;
  const plotTop = 14;
  const baselineY = layout.height - 26;
  const credit = Number(input.creditTokens);
  const need = Number(needTokens);
  const xMax = niceCeil(need * 1.45);
  const yMax = eff(xMax) * 1.15;
  // The replica is undefined only at credit 0 with magicValue 0 or past an overflow, which grows
  // with credit, so checking both ends of the axis covers every sample.
  if (!Number.isFinite(yMax) || !Number.isFinite(eff(0)))
    return { kind: 'none' };
  const X = (c: number) => plotLeft + ((plotRight - plotLeft) * c) / xMax;
  const Y = (limit: number) =>
    baselineY - ((baselineY - plotTop) * limit) / yMax;
  const path = (credits: number[]) =>
    credits
      .map((c, i) => `${i ? ' L' : 'M'}${r1(X(c))} ${r1(Y(eff(c)))}`)
      .join('');
  const youX = r1(X(credit));
  const youY = r1(Y(Number(input.limitTokens)));
  const goalX = r1(X(need));
  const goalY = r1(Y(eff(need)));
  const top = niceFloor(yMax * 0.9);
  const youLabelX = Math.min(Math.max(youX - 60, 4), plotRight - 98);
  const rightCredit = Math.max(
    0,
    Math.min(
      xMax,
      ((youLabelX + 92 - plotLeft) / (plotRight - plotLeft)) * xMax,
    ),
  );
  const curveTop = Y(eff(rightCredit));
  const labelAboveDot = youY - 44;
  const labelAboveCurve =
    labelAboveDot + 20 > curveTop ? curveTop - 22 : labelAboveDot;
  const youLabelY = labelAboveCurve < 24 ? 24 : labelAboveCurve;
  const gridLabel = formatNumber(top);
  const gridHit =
    plotLeft < youLabelX + 92 &&
    youLabelX < plotLeft + 7.2 * gridLabel.length + 2 &&
    Y(top) - 15.5 < youLabelY + 16.5 &&
    youLabelY - 9.5 < Y(top) - 3.5;
  // Main's 30 / 42 / 50 px tick gaps are for a 298 px plot.
  const tickScale = (plotRight - plotLeft) / 298;
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
    baselineY,
    tickY: layout.height - 8,
    curvePath: path(
      Array.from({ length: 49 }, (_, i) =>
        Math.round(xMax * (i / 48) * (i / 48)),
      ),
    ),
    highlightPath: path(
      Array.from({ length: 17 }, (_, i) =>
        Math.round(credit + (need - credit) * (i / 16) * (i / 16)),
      ),
    ),
    you: { x: youX, y: youY },
    goal: { x: goalX, y: goalY },
    grid: {
      y: r1(Y(top)),
      labelY: r1(Y(top) - 6),
      label: gridLabel,
      labelVisible: !(layout.inChartLabels && gridHit),
    },
    ticks: {
      zero: {
        x: plotLeft,
        label: '0',
        anchor: 'start',
        visible: youX > 30 * tickScale,
      },
      credit: {
        x: youX,
        label: formatTokens(input.creditTokens),
        anchor: 'middle',
        visible: true,
      },
      need: {
        x: goalX,
        label: formatTokens(needTokens),
        anchor: 'middle',
        visible: goalX - youX >= 42 * tickScale,
      },
      max: {
        x: plotRight,
        label: formatNumber(xMax),
        anchor: 'end',
        visible: plotRight - goalX >= 50 * tickScale,
      },
    },
    labels: layout.inChartLabels
      ? {
          you: { x: r1(youLabelX), y: r1(youLabelY) },
          goal: { x: r1(goalX + 9), y: r1(goalY + 17) },
          leadTop: r1(youLabelY + 18),
          leadBottom: r1(youY - 7),
        }
      : null,
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

// Cap-reached log chart (spec §10.6): log10 credit axis, linear limit axis up to amount × 1.15.
const capChart = (
  curve: ReputationCurve,
  input: ChartInput,
  layout: ChartLayout,
): CapChart | { kind: 'beyondCap' } => {
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
  const limits = samples.map((c) => effectiveAt(curve, c));
  if (!limits.every(Number.isFinite)) return { kind: 'beyondCap' };
  const decades = Array.from({ length: 4 }, (_, i) =>
    Math.pow(10, logMin + 1 + i),
  ).filter((c) => c < xMax);
  const startLabel = compactNumber(Math.pow(10, logMin));
  const endLabel = compactNumber(credit);
  const labelWidth = (label: string) => 7.2 * label.length;
  const endLeft = plotRight - labelWidth(endLabel);
  // A decade label is hidden when it would come within 4px of the end label or the previous visible label.
  const middle = decades.reduce<{ ticks: ChartTick[]; right: number }>(
    (acc, c) => {
      const x = r1(X(c));
      const label = compactNumber(c);
      const half = labelWidth(label) / 2;
      const visible = x - half >= acc.right + 4 && x + half + 4 <= endLeft;
      return {
        ticks: [...acc.ticks, { x, label, anchor: 'middle', visible }],
        right: visible ? x + half : acc.right,
      };
    },
    { ticks: [], right: plotLeft + labelWidth(startLabel) },
  );
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
    ticks: [
      { x: plotLeft, label: startLabel, anchor: 'start', visible: true },
      ...middle.ticks,
      { x: plotRight, label: endLabel, anchor: 'end', visible: true },
    ],
    text: {
      credit: formatTokens(input.creditTokens),
      amount: formatBrl(input.amountCents),
    },
  };
};

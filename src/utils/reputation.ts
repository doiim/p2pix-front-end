import type { Address } from 'viem';

// Mirrors p2pix-smart-contracts/contracts/core/Constants.sol (internal constants, no getter; pinned by tests/reputation/constants.test.ts).
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
export type PanelTag = 'howItWorks' | 'verification';
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

// Supporting detail

// Dot-grouped thousands with a non-zero first group, so "0.500" stays 0,5 (spec A6).
const DOT_THOUSANDS = /^[1-9]\d{0,2}(\.\d{3})+$/;
const PLAIN_DECIMAL = /^(\d+\.?\d*|\.\d+)$/;

const centsFraction = (cents: bigint) => String(cents % 100n).padStart(2, '0');

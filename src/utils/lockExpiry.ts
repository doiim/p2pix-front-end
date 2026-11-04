import { arbitrum, mainnet, sepolia } from 'viem/chains';
import { hexToBigInt, isHex } from 'viem';

// The contract compares `expirationBlock` with Solidity's `block.number`. On
// Arbitrum that is the L1 (Ethereum) block number, not the L2 one. Chains
// absent here have no known clock, so they get no countdown rather than a
// wrong one.
const SECONDS_PER_CONTRACT_BLOCK: Record<number, number> = {
  [mainnet.id]: 12,
  [sepolia.id]: 12,
  [arbitrum.id]: 12,
};

const isBlockLike = (value: unknown): value is { number: bigint } =>
  typeof value === 'object' &&
  value !== null &&
  'number' in value &&
  typeof value.number === 'bigint';

/** The block number the contract sees, from a `getBlock()` answer; null if unreadable. */
export const contractBlockNumber = (
  chainId: number,
  block: unknown,
): bigint | null => {
  if (!isBlockLike(block)) return null;
  if (chainId !== arbitrum.id) return block.number;
  // Arbitrum answers carry the L1 number as `l1BlockNumber`; viem leaves it untyped.
  const l1 = 'l1BlockNumber' in block ? block.l1BlockNumber : undefined;
  if (typeof l1 === 'bigint') return l1;
  return typeof l1 === 'string' && isHex(l1) ? hexToBigInt(l1) : null;
};

/** Seconds until the lock expires as of `block`; null when the chain's clock is unknown. */
export const secondsToExpiry = (
  chainId: number,
  expirationBlock: bigint,
  block: unknown,
): number | null => {
  const perBlock = SECONDS_PER_CONTRACT_BLOCK[chainId];
  const current = contractBlockNumber(chainId, block);
  if (perBlock === undefined || current === null || expirationBlock === 0n)
    return null;
  const blocks = expirationBlock - current;
  return blocks <= 0n ? 0 : Number(blocks) * perBlock;
};

const pad = (n: number) => String(n).padStart(2, '0');

export const URGENT_SECONDS = 10 * 60;

/** "Pague em até HH:MM:SS" (or days beyond 24 h); "Pague logo: ..." under 10 min. */
export const countdownText = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  if (total <= URGENT_SECONDS)
    return `Pague logo: a reserva expira em ${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  if (total > 24 * 3600) {
    const days = Math.ceil(total / 86400);
    return `Pague em até ${days} dias`;
  }
  const h = Math.floor(total / 3600);
  return `Pague em até ${pad(h)}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
};

export const EXPIRED_TEXT = 'Reserva expirada. Não pague este QR.';

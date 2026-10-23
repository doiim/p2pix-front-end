// Per-chain AA (Kernel / passkey) configuration.
//
// Each entry is keyed by viem chain id. Absence means AA is disabled on the
// chain — callers treat `network.aa === undefined` as "AA off here".
//
// Bundler URLs are set per chain in config/networks.ts; the sponsorship policy
// id is the only remaining Pimlico env var read here.

import { resolveRpId } from '@doiim/passkeys';

import type { TokenEnum } from '@/model/NetworkEnum';

/**
 * Per-chain AA settings. All fields are optional.
 */
export type AaConfig = {
  /**
   * Per-chain bundler URL, built in `config/networks.ts`. AA is unavailable on
   * the chain while unset.
   */
  bundlerUrl?: string;
  /**
   * Minimum fee token balance (in wei) to attempt paymaster fees. Below this,
   * use sponsored UserOps. Assumes an 18-decimal fee token. Falls back to
   * `MIN_FEE_BALANCE_WEI_DEFAULT`.
   */
  minFeeBalance?: bigint;
  /**
   * Token Pimlico's ERC-20 paymaster charges gas in. Unset = sponsorship only
   * (P2Pix pays gas and charges its fee inside protocol transactions). Unset on
   * every network today because the paymaster does not support BRZ.
   */
  feeToken?: TokenEnum;
};

export const env = (key: string): string | undefined =>
  (import.meta.env[key] as string | undefined)?.trim() || undefined;

/** Hosts we operate as one passkey realm. */
// TODO: extra origins (e.g. an ENS gateway) via Related Origin Requests — list
// them and have nginx serve https://p2pix.co/.well-known/webauthn. Deferred
// 2026-10-15: only p2pix.co for now.
export const PASSKEY_SHARED_SUFFIXES = ['demo.p2pix.co', 'p2pix.co'] as const;

/**
 * WebAuthn RP id, or `null` when passkeys are disabled. Resolution order:
 *   1. `VITE_PASSKEY_RP_ID` override (another owned origin; it must serve
 *      `https://<rpId>/.well-known/webauthn` for Related Origin Requests);
 *   2. the longest owned suffix the host belongs to, so `*.p2pix.co` and
 *      `*.demo.p2pix.co` keep sharing their credentials;
 *   3. `localhost` for local development (browsers reject IP literals as rpId,
 *      so 127.0.0.1 stays disabled);
 *   4. otherwise `null`. A path-style IPFS gateway (`ipfs.io/ipfs/<cid>`)
 *      shares one origin across every CID, so any page there could ask the
 *      passkey to sign: never enable passkeys on an origin we do not own.
 */
export const rpId: string | null = resolveRpId(window.location.hostname, {
  override: env('VITE_PASSKEY_RP_ID'),
  sharedSuffixes: PASSKEY_SHARED_SUFFIXES,
  strict: true,
});

/** The rpId for code paths that only run when passkeys are enabled. */
export const requireRpId = (): string => {
  if (!rpId) throw new Error('Passkeys are disabled on this origin');
  return rpId;
};

/**
 * Default minimum fee token balance (in wei) to attempt paymaster fees, used
 * when a chain's `AaConfig.minFeeBalance` is unset. Assumes an 18-decimal fee
 * token; override per chain if a network's fee token differs.
 */
export const MIN_FEE_BALANCE_WEI_DEFAULT = 100000000000000000n; // 0.1 fee token (18 decimals)

export const sponsorshipPolicyId = (): string | undefined =>
  env('VITE_PIMLICO_SPONSORSHIP_POLICY_ID');

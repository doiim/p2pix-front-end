// Per-chain AA (Kernel / passkey) configuration.
//
// Each entry is keyed by viem chain id. Absence means AA is disabled on the
// chain — callers treat `network.aa === undefined` as "AA off here".
//
// Bundler URLs are set per chain in config/networks.ts; the sponsorship policy
// id is the only remaining Pimlico env var read here.
// VITE_REOWN_PROJECT_ID is read directly in config/appkit.ts.

import { resolveRpId as resolveSharedRpId } from '@doiim/passkeys';

import type { NetworkConfig } from '@/model/NetworkEnum';

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
};

const DEMO_RP_ID = 'demo.p2pix.co';
const PROD_RP_ID = 'p2pix.co';

/** Hosts we operate as one passkey realm, longest suffix first. */
const RP_ID_SUFFIXES = [DEMO_RP_ID, PROD_RP_ID] as const;

/** Build-time realm, used only when there is no browser origin to read. */
const FALLBACK_RP_ID =
  import.meta.env.VITE_APP_ENV === 'production' ? PROD_RP_ID : DEMO_RP_ID;

/**
 * Origin-aware WebAuthn RP id.
 *
 * The rules live in `@doiim/passkeys`; this module owns only the policy — the
 * hosts we operate as one passkey realm, plus the operator override. Resolution:
 *   1. `VITE_PASSKEY_RP_ID` override, for operators self-hosting under their
 *      own apex;
 *   2. the longest configured shared suffix this host belongs to, so
 *      `*.p2pix.co` and `*.demo.p2pix.co` keep sharing their existing
 *      credentials;
 *   3. the host itself — IPFS gateways and any other origin get their own
 *      passkey realm (WebAuthn cannot share one credential across unrelated
 *      hosts).
 */
export const resolveRpId = (
  hostname: string = typeof window !== 'undefined'
    ? window.location.hostname
    : '',
): string =>
  resolveSharedRpId(hostname || FALLBACK_RP_ID, {
    override: import.meta.env.VITE_PASSKEY_RP_ID as string | undefined,
    sharedSuffixes: RP_ID_SUFFIXES,
  });

export const rpId = resolveRpId();

/**
 * Default minimum fee token balance (in wei) to attempt paymaster fees, used
 * when a chain's `AaConfig.minFeeBalance` is unset. Assumes an 18-decimal fee
 * token (e.g., BRZ); override per chain if a network's fee token differs.
 */
export const MIN_FEE_BALANCE_WEI_DEFAULT = 100000000000000000n; // 0.1 BRZ (18 decimals)

const env = (key: string): string | undefined =>
  (import.meta.env[key] as string | undefined)?.trim() || undefined;

export const sponsorshipPolicyId = (): string | undefined =>
  env('VITE_PIMLICO_SPONSORSHIP_POLICY_ID');

/**
 * AA is usable only with a bundler and, on Pimlico, a sponsorship policy.
 * Single source of truth shared by the login gate (passkey CTA) and the AA
 * runtime, so both agree on which chains can host a Kernel account.
 */
export const isAaAvailable = (network: NetworkConfig | undefined): boolean => {
  if (!network?.aa?.bundlerUrl) return false;
  return Boolean(sponsorshipPolicyId());
};

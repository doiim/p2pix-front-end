// Per-chain AA (Kernel / passkey) configuration.
//
// Each entry is keyed by viem chain id. Absence means AA is disabled on the
// chain — callers treat `network.aa === undefined` as "AA off here".
//
// Bundler URLs are set per chain in config/networks.ts; the sponsorship policy
// id is the only remaining Pimlico env var read here.
// VITE_REOWN_PROJECT_ID is read directly in config/appkit.ts.

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

/**
 * WebAuthn RP id shared across AA-enabled chains: `p2pix.co` in production,
 * `demo.p2pix.co` otherwise (demo builds are served from `<n>.demo.p2pix.co`,
 * so the passkey must be registered for the shared suffix).
 */
export const rpId =
  import.meta.env.VITE_APP_ENV === 'production' ? 'p2pix.co' : 'demo.p2pix.co';

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

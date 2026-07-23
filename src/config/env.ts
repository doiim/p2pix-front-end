// Single source of truth for VITE_* environment variables. Hand-rolled (no zod).

const required = (key: string): string => {
  const v = (import.meta.env[key] as string | undefined)?.trim();
  if (!v) {
    throw new Error(
      `[env] required VITE_* variable missing: ${key}. ` +
        `Set it in .env / .env.local before booting the app.`,
    );
  }
  return v;
};

const optional = (key: string): string | undefined => {
  const v = (import.meta.env[key] as string | undefined)?.trim();
  return v ? v : undefined;
};

const optionalNumber = (key: string): number | undefined => {
  const v = optional(key);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

const optionalAddress = (key: string): `0x${string}` | undefined => {
  const v = optional(key);
  return v ? (v as `0x${string}`) : undefined;
};

const firstEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = optional(key);
    if (value !== undefined) return value;
  }
  return undefined;
};

const firstAddressEnv = (...keys: string[]): `0x${string}` | undefined => {
  for (const key of keys) {
    const value = optionalAddress(key);
    if (value !== undefined) return value;
  }
  return undefined;
};

const legacyBundlerUrl = optional('VITE_BUNDLER_URL');
const arbitrumSponsorshipPolicyId = firstEnv(
  'VITE_PIMLICO_ARBITRUM_SPONSORSHIP_POLICY_ID',
  'VITE_ARBITRUM_SPONSORSHIP_POLICY_ID',
  'VITE_PIMLICO_SPONSORSHIP_POLICY_ID',
);
const mainnetSponsorshipPolicyId = firstEnv(
  'VITE_PIMLICO_MAINNET_SPONSORSHIP_POLICY_ID',
  'VITE_MAINNET_SPONSORSHIP_POLICY_ID',
);
const mainnetPaymasterToken = firstAddressEnv(
  'VITE_PIMLICO_MAINNET_PAYMASTER_TOKEN_ADDRESS',
  'VITE_MAINNET_PAYMASTER_TOKEN_ADDRESS',
);
const arbitrumPaymasterToken = firstAddressEnv(
  'VITE_PIMLICO_ARBITRUM_PAYMASTER_TOKEN_ADDRESS',
  'VITE_ARBITRUM_PAYMASTER_TOKEN_ADDRESS',
);

const operationPaymasterPolicies = (
  sponsorshipPolicyId: string | undefined,
  token: `0x${string}` | undefined,
) => ({
  ...(sponsorshipPolicyId ? { firstLock: { sponsorshipPolicyId } } : {}),
  ...(token ? { paidOperations: { token } } : {}),
});

// Backendless by default: the first-lock subsidy is decided client-side by
// fee-token affordability and bounded by the Pimlico policy caps. Set
// VITE_AA_SPONSORSHIP_MODE=backend once the /aa/first-lock-authorization
// endpoint + Pimlico webhook exist to gate one sponsored lock per identity.
const sponsorshipMode: 'caps-only' | 'backend' =
  optional('VITE_AA_SPONSORSHIP_MODE') === 'backend' ? 'backend' : 'caps-only';

export const env = {
  reownProjectId: required('VITE_REOWN_PROJECT_ID'),
  environment: optional('VITE_ENVIRONMENT'),
  appApiUrl: optional('VITE_APP_API_URL'),

  sepolia: {
    rpc: optional('VITE_SEPOLIA_API_URL'),
    p2pix: optionalAddress('VITE_SEPOLIA_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_SEPOLIA_TOKEN_ADDRESS'),
    subgraph: optional('VITE_SEPOLIA_SUBGRAPH_URL'),
    // Legacy override knob (kept for back-compat with the early-dev path that
    // hijacked sepolia chainId for a local hardhat node). Prefer VITE_LOCAL_*
    // for the localhost network nowadays.
    chainIdOverride: optionalNumber('VITE_SEPOLIA_CHAIN_ID'),
  },

  rsk: {
    rpc: optional('VITE_RSK_API_URL'),
    p2pix: optionalAddress('VITE_RSK_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_RSK_TOKEN_ADDRESS'),
    subgraph: optional('VITE_RSK_SUBGRAPH_URL'),
  },

  // Arbitrum One (42161). The connector derives the same Kernel account on
  // each configured chain; these fields enable P2Pix trading on Arbitrum once
  // the contracts and subgraph are deployed there.
  arbitrum: {
    rpc: optional('VITE_ARBITRUM_API_URL'),
    p2pix: optionalAddress('VITE_ARBITRUM_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_ARBITRUM_TOKEN_ADDRESS'),
    subgraph: optional('VITE_ARBITRUM_SUBGRAPH_URL'),
  },

  ethereum: {
    rpc: optional('VITE_MAINNET_API_URL'),
    p2pix: optionalAddress('VITE_MAINNET_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_MAINNET_TOKEN_ADDRESS'),
    subgraph: optional('VITE_MAINNET_SUBGRAPH_URL'),
  },

  local: {
    p2pix: optionalAddress('VITE_LOCAL_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_LOCAL_TOKEN_ADDRESS'),
  },

  passkey: {
    rpId: optional('VITE_PASSKEY_RP_ID'),
    pimlicoApiKey: optional('VITE_PIMLICO_API_KEY'),
    /** How the first-lock subsidy is gated. See {@link sponsorshipMode}. */
    sponsorshipMode,
    bundlerUrl: legacyBundlerUrl,
    /** Chain-specific bundler overrides; the legacy URL remains the fallback. */
    bundlerUrls: {
      1: optional('VITE_MAINNET_BUNDLER_URL'),
      42161: optional('VITE_ARBITRUM_BUNDLER_URL'),
    },
    /** Both operation rails may be configured simultaneously on each chain. */
    paymasterPolicies: {
      1: operationPaymasterPolicies(
        mainnetSponsorshipPolicyId,
        mainnetPaymasterToken,
      ),
      42161: operationPaymasterPolicies(
        arbitrumSponsorshipPolicyId,
        arbitrumPaymasterToken,
      ),
    },
    // RPC URL used by the passkey connector for Kernel account reads. The
    // inline client is required for custom local chains.
    rpcUrl:
      firstEnv('VITE_LOCAL_RPC_URL') ??
      (optionalAddress('VITE_LOCAL_P2PIX_ADDRESS')
        ? 'http://127.0.0.1:8545'
        : undefined),
  },
} as const;

export type Env = typeof env;

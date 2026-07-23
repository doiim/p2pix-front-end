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

  // Arbitrum One (42161) — the chain the passkey smart account runs on off
  // local dev (see config/passkey.ts). The passkey connector only needs the
  // RPC (falls back to viem's default arbitrum RPC when unset). The p2pix/token/
  // subgraph fields enable P2Pix trading on Arbitrum once the contracts +
  // subgraph are deployed there — leave empty until then.
  arbitrum: {
    rpc: optional('VITE_ARBITRUM_API_URL'),
    p2pix: optionalAddress('VITE_ARBITRUM_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_ARBITRUM_TOKEN_ADDRESS'),
    subgraph: optional('VITE_ARBITRUM_SUBGRAPH_URL'),
  },

  local: {
    p2pix: optionalAddress('VITE_LOCAL_P2PIX_ADDRESS'),
    token: optionalAddress('VITE_LOCAL_TOKEN_ADDRESS'),
  },

  passkey: {
    rpId: optional('VITE_PASSKEY_RP_ID'),
    pimlicoApiKey: optional('VITE_PIMLICO_API_KEY'),
    // Pimlico sponsorship-policy id. When set (on a non-local chain), passkey
    // UserOps (withdraw, sweep, …) are gas-sponsored by the policy. Left empty
    // locally — anvil (31337) uses the self-bundler regardless.
    sponsorshipPolicyId: optional('VITE_PIMLICO_SPONSORSHIP_POLICY_ID'),
    // 'exactly-mode' (default): requires webauthnPluginAddress/factoryAddress
    // from a live deployment of exactly/webauthn-owner-plugin. 'kernel':
    // ZeroDev Kernel via permissionless — no custom deploy needed, only a
    // bundler (pimlicoApiKey or bundlerUrl above).
    accountKind:
      (optional('VITE_ACCOUNT_KIND') as
        | 'exactly-mode'
        | 'kernel'
        | undefined) ?? 'exactly-mode',
    webauthnPluginAddress: optionalAddress('VITE_WEBAUTHN_PLUGIN_ADDRESS'),
    factoryAddress: optionalAddress('VITE_WEBAUTHN_FACTORY_ADDRESS'),
    entryPointAddress: optionalAddress('VITE_ENTRYPOINT_ADDRESS'),
    bundlerUrl: optional('VITE_BUNDLER_URL'),
    // RPC URL the passkey connector uses for chain reads (factory.getAddress,
    // EntryPoint nonce/userOpHash, tx receipts). Bypasses wagmi's getClient
    // resolver — required for custom chains (anvil 31337). Defaults to the
    // local anvil RPC when VITE_LOCAL_P2PIX_ADDRESS is set, otherwise unset.
    rpcUrl:
      optional('VITE_LOCAL_RPC_URL') ??
      (optionalAddress('VITE_LOCAL_P2PIX_ADDRESS')
        ? 'http://127.0.0.1:8545'
        : undefined),
  },
} as const;

export type Env = typeof env;

import {
  sepolia,
  rootstock,
  rootstockTestnet,
  arbitrum,
  mainnet,
} from '@doiim/reown-appkit/networks';
import type { AppKitNetwork } from '@doiim/reown-appkit/networks';
import {
  type AaNetworkConfig,
  type NetworkConfig,
  type OperationPaymasterPolicies,
} from '@/model/NetworkEnum';
import { env, type Env } from '@/config/env';

export const isTestnetEnvironment = (env?: Env) => {
  return (
    env?.environment === 'testnet' ||
    import.meta.env.NODE_ENV === 'development' ||
    import.meta.env.MODE === 'development'
  );
};

type NetworkOverlay = {
  rpc?: string;
  p2pix?: `0x${string}`;
  token?: `0x${string}`;
  subgraph?: string;
  aa?: AaNetworkConfig;
};

const overlay = (base: AppKitNetwork, cfg: NetworkOverlay): NetworkConfig =>
  ({
    ...base,
    id: Number(base.id),
    rpcUrls: {
      ...(base.rpcUrls ?? {}),
      default: {
        ...base.rpcUrls.default,
        http: cfg.rpc ? [cfg.rpc] : base.rpcUrls.default.http,
      },
    },
    contracts: {
      ...((base as { contracts?: object }).contracts ?? {}),
      p2pix: { address: (cfg.p2pix ?? '0x') as `0x${string}` },
    },
    tokens: {
      BRZ: { address: (cfg.token ?? '0x') as `0x${string}` },
    },
    subgraphUrls: [cfg.subgraph ?? ''],
    ...(cfg.aa ? { aa: cfg.aa } : {}),
  }) as NetworkConfig;

const hasTradingDeployment = (cfg: NetworkOverlay): boolean =>
  Boolean(cfg.p2pix && cfg.token);

const getConfiguredPaymasterPolicies = (
  env: Env,
  chainId: 1 | 42161,
): OperationPaymasterPolicies => env.passkey.paymasterPolicies[chainId];

const buildAaConfig = (env: Env, chainId: 1 | 42161): AaNetworkConfig => {
  const paymasterPolicies = getConfiguredPaymasterPolicies(env, chainId);
  return {
    bundlerUrl: env.passkey.bundlerUrls[chainId] ?? env.passkey.bundlerUrl,
    paymasterPolicies,
    ...(paymasterPolicies.paidOperations
      ? {
          paymasterPolicy: {
            type: 'erc20' as const,
            token: paymasterPolicies.paidOperations.token,
          },
        }
      : {}),
  };
};

export const buildNetworks = (env: Env) => {
  // chainIdOverride: legacy back-compat knob (see env.ts).
  const sepoliaBase = env.sepolia.chainIdOverride
    ? { ...sepolia, id: env.sepolia.chainIdOverride }
    : sepolia;
  const sepoliaConfig = overlay(sepoliaBase, env.sepolia);

  const rootstockBase = isTestnetEnvironment(env)
    ? rootstockTestnet
    : rootstock;
  const rootstockConfig = overlay(rootstockBase, env.rsk);

  // Arbitrum One (42161) — must be a registered network so AppKit accepts the
  // passkey smart account's chain (kernel mode runs there — see config/passkey.ts).
  // Without this, connecting a passkey triggers AppKit's "unsupported network"
  // modal. P2Pix trading on Arbitrum activates once VITE_ARBITRUM_P2PIX_ADDRESS /
  // _TOKEN_ADDRESS / _SUBGRAPH_URL are set (contracts + subgraph deployed there);
  // until then it's an AA-only chain. RPC falls back to the Reown transport when
  // VITE_ARBITRUM_API_URL is unset.
  const arbitrumOverlay: NetworkOverlay = {
    rpc: env.arbitrum.rpc,
    p2pix: env.arbitrum.p2pix,
    token: env.arbitrum.token,
    subgraph: env.arbitrum.subgraph,
  };
  const arbitrumTrading = hasTradingDeployment(arbitrumOverlay);
  const arbitrumConfig = overlay(arbitrum as AppKitNetwork, {
    ...arbitrumOverlay,
    ...(arbitrumTrading ? { aa: buildAaConfig(env, 42161) } : {}),
  });

  const ethereumOverlay: NetworkOverlay = {
    rpc: env.ethereum.rpc,
    p2pix: env.ethereum.p2pix,
    token: env.ethereum.token,
    subgraph: env.ethereum.subgraph,
  };
  const ethereumTrading = hasTradingDeployment(ethereumOverlay);
  const ethereumConfig = overlay(mainnet as AppKitNetwork, {
    ...ethereumOverlay,
    ...(ethereumTrading ? { aa: buildAaConfig(env, 1) } : {}),
  });

  const localAnvil: NetworkConfig | null = env.local.p2pix
    ? {
        id: 31337,
        name: 'Localhost',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
        contracts: {
          p2pix: { address: env.local.p2pix as `0x${string}` },
        },
        tokens: {
          BRZ: { address: (env.local.token ?? '0x') as `0x${string}` },
        },
        subgraphUrls: [],
        aa: {
          bundlerUrl: env.passkey.bundlerUrl,
          paymasterPolicies: {},
        },
      }
    : null;

  const networks: { [key: string]: NetworkConfig } = {
    sepolia: sepoliaConfig,
    rootstock: rootstockConfig,
    ...(arbitrumTrading ? { arbitrum: arbitrumConfig } : {}),
    ...(ethereumTrading ? { ethereum: ethereumConfig } : {}),
    ...(localAnvil ? { localhost: localAnvil } : {}),
  };

  const wagmiNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
    sepoliaConfig as AppKitNetwork,
    rootstockConfig as AppKitNetwork,
    arbitrumConfig as AppKitNetwork,
    ethereumConfig as AppKitNetwork,
    ...(localAnvil ? [localAnvil as AppKitNetwork] : []),
  ];

  const defaultNetwork = localAnvil ?? sepoliaConfig;

  return { networks, wagmiNetworks, defaultNetwork };
};

/** Resolves the Kernel configuration from the active trading chain. */
export const getAaNetworkConfig = (
  chainId: number,
  networks: Record<string, NetworkConfig> = Networks,
): AaNetworkConfig | undefined =>
  Object.values(networks).find((network) => network.id === chainId)?.aa;

// @deprecated Eager singleton kept for module-load consumers (useUser,
// events, etc.). Migrate callers to `getWagmiConfig().chains` and remove
// — duplicates work that `setupAppKit(env)` already does.
const _singleton = buildNetworks(env);
export const Networks = _singleton.networks;
export const DEFAULT_NETWORK = _singleton.defaultNetwork;

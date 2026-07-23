import {
  sepolia,
  rootstock,
  rootstockTestnet,
} from '@doiim/reown-appkit/networks';
import type { AppKitNetwork } from '@doiim/reown-appkit/networks';
import { NetworkConfig } from '@/model/NetworkEnum';
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
};

const overlay = (base: AppKitNetwork, cfg: NetworkOverlay): NetworkConfig =>
  ({
    ...base,
    id: Number(base.id),
    rpcUrls: { default: { http: [cfg.rpc ?? ''] } },
    contracts: {
      ...((base as { contracts?: object }).contracts ?? {}),
      p2pix: { address: (cfg.p2pix ?? '0x') as `0x${string}` },
    },
    tokens: {
      BRZ: { address: (cfg.token ?? '0x') as `0x${string}` },
    },
    subgraphUrls: [cfg.subgraph ?? ''],
  }) as NetworkConfig;

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
      }
    : null;

  const networks: { [key: string]: NetworkConfig } = {
    sepolia: sepoliaConfig,
    rootstock: rootstockConfig,
    ...(localAnvil ? { localhost: localAnvil } : {}),
  };

  const wagmiNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
    sepoliaConfig as AppKitNetwork,
    rootstockConfig as AppKitNetwork,
    ...(localAnvil ? [localAnvil as AppKitNetwork] : []),
  ];

  const defaultNetwork = localAnvil ?? sepoliaConfig;

  return { networks, wagmiNetworks, defaultNetwork };
};

// @deprecated Eager singleton kept for module-load consumers (useUser,
// events, etc.). Migrate callers to `getWagmiConfig().chains` and remove
// — duplicates work that `setupAppKit(env)` already does.
const _singleton = buildNetworks(env);
export const Networks = _singleton.networks;
export const DEFAULT_NETWORK = _singleton.defaultNetwork;

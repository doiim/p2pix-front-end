import { sepolia, rootstock, rootstockTestnet } from '@reown/appkit/networks';
import type { AppKitNetwork } from '@reown/appkit/networks';
import { NetworkConfig } from '@/model/NetworkEnum';
// TODO: import addresses from p2pix-smart-contracts deployments

export const isTestnetEnvironment = () => {
  return (
    import.meta.env.VITE_ENVIRONMENT === 'testnet' ||
    import.meta.env.NODE_ENV === 'development' ||
    import.meta.env.MODE === 'development'
  );
};

export const Networks: { [key: string]: NetworkConfig } = {
  sepolia: {
    ...sepolia,
    rpcUrls: { default: { http: [import.meta.env.VITE_SEPOLIA_API_URL] } },
    contracts: {
      ...sepolia.contracts,
      p2pix: {
        address: import.meta.env.VITE_SEPOLIA_P2PIX_ADDRESS as `0x${string}`,
      },
    },
    tokens: {
      BRZ: {
        address: import.meta.env.VITE_SEPOLIA_TOKEN_ADDRESS as `0x${string}`,
      },
    },
    subgraphUrls: [import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL],
  },
  rootstock: {
    ...(isTestnetEnvironment() ? rootstockTestnet : rootstock),
    rpcUrls: { default: { http: [import.meta.env.VITE_RSK_API_URL] } },
    contracts: {
      ...(isTestnetEnvironment()
        ? rootstockTestnet.contracts
        : rootstock.contracts),
      p2pix: {
        address: import.meta.env.VITE_RSK_P2PIX_ADDRESS as `0x${string}`,
      },
    },
    tokens: {
      BRZ: { address: import.meta.env.VITE_RSK_TOKEN_ADDRESS as `0x${string}` },
    },
    subgraphUrls: [import.meta.env.VITE_RSK_SUBGRAPH_URL],
  },
};

export const DEFAULT_NETWORK = Networks.sepolia;

export const wagmiNetworks: [AppKitNetwork, ...AppKitNetwork[]] = [
  Networks.sepolia as AppKitNetwork,
  Networks.rootstock as AppKitNetwork,
];

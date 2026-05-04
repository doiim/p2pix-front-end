import { mainnet, sepolia, rootstock, rootstockTestnet } from 'viem/chains';
import { NetworkConfig } from '@/model/NetworkEnum';
// TODO: import addresses from p2pix-smart-contracts deployments

export const Networks: { [key: string]: NetworkConfig } = {
  mainnet: {
    ...mainnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_MAINNET_API_URL] } },
    contracts: {
      ...mainnet.contracts,
      p2pix: { address: import.meta.env.VITE_MAINNET_P2PIX_ADDRESS },
    },
    tokens: {
      BRZ: { address: import.meta.env.VITE_MAINNET_TOKEN_ADDRESS },
    },
    subgraphUrls: [import.meta.env.VITE_MAINNET_SUBGRAPH_URL],
  },
  rootstock: {
    ...rootstock,
    rpcUrls: { default: { http: [import.meta.env.VITE_RSK_API_URL] } },
    contracts: {
      ...rootstock.contracts,
      p2pix: { address: import.meta.env.VITE_RSK_P2PIX_ADDRESS },
    },
    tokens: {
      BRZ: { address: import.meta.env.VITE_RSK_TOKEN_ADDRESS },
    },
    subgraphUrls: [import.meta.env.VITE_RSK_SUBGRAPH_URL],
  },
};

export const NetworksTestnet: { [key: string]: NetworkConfig } = {
  sepolia: {
    ...sepolia,
    rpcUrls: { default: { http: [import.meta.env.VITE_SEPOLIA_API_URL] } },
    contracts: {
      ...sepolia.contracts,
      p2pix: { address: import.meta.env.VITE_SEPOLIA_P2PIX_ADDRESS },
    },
    tokens: {
      BRZ: { address: import.meta.env.VITE_SEPOLIA_TOKEN_ADDRESS },
    },
    subgraphUrls: [import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL],
  },
  rootstockTestnet: {
    ...rootstockTestnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_RSK_API_URL] } },
    contracts: {
      ...rootstockTestnet.contracts,
      p2pix: { address: import.meta.env.VITE_RSK_P2PIX_ADDRESS },
    },
    tokens: {
      BRZ: { address: import.meta.env.VITE_RSK_TOKEN_ADDRESS },
    },
    subgraphUrls: [import.meta.env.VITE_RSK_SUBGRAPH_URL],
  },
};

export const DEFAULT_NETWORK = Networks.mainnet;

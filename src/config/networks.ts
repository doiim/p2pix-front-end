import type { Address } from 'viem';
import { mainnet, sepolia, rootstock, rootstockTestnet } from 'viem/chains';
import { NetworkConfig } from '@/model/NetworkEnum';
const artifacts = import.meta.glob<Record<string, Address>>(
  './chain-*/deployed_addresses.json',
  {
    eager: true,
    import: 'default',
    base: '/p2pix-smart-contracts/ignition/deployments',
  },
);
const deployments = (id: number) =>
  artifacts[`./chain-${id}/deployed_addresses.json`]!;

const NetworksMainnet: { [key: string]: NetworkConfig } = {
  mainnet: {
    ...mainnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_MAINNET_API_URL] } },
    contracts: {
      ...mainnet.contracts,
      p2pix: { address: deployments(mainnet.id)['P2PIX#P2PIX'] },
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

/** @public */
const NetworksTestnet: { [key: string]: NetworkConfig } = {
  sepolia: {
    ...sepolia,
    rpcUrls: { default: { http: [import.meta.env.VITE_SEPOLIA_API_URL] } },
    contracts: {
      ...sepolia.contracts,
      p2pix: { address: deployments(sepolia.id)['P2PIX#P2PIX'] },
    },
    tokens: {
      BRZ: { address: deployments(sepolia.id)['MockToken#MockToken'] },
    },
    subgraphUrls: [import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL],
  },
  rootstockTestnet: {
    ...rootstockTestnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_RSK_API_URL] } },
    contracts: {
      ...rootstockTestnet.contracts,
      p2pix: { address: deployments(rootstockTestnet.id)['P2PIX#P2PIX'] },
    },
    tokens: {
      BRZ: { address: deployments(rootstockTestnet.id)['MockToken#MockToken'] },
    },
    subgraphUrls: [import.meta.env.VITE_RSK_SUBGRAPH_URL],
  },
};

export const Networks = import.meta.env.PROD
  ? NetworksMainnet
  : NetworksTestnet;
export const DEFAULT_NETWORK = import.meta.env.PROD
  ? Networks.mainnet
  : Networks.sepolia;

import type { Address, Chain } from 'viem';
import {
  mainnet,
  sepolia,
  rootstock,
  rootstockTestnet,
  arbitrum,
} from 'viem/chains';
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

const p2pix = (chain: Chain) => ({
  p2pix: { address: deployments(chain.id)['P2PIX#P2PIX'] },
});

const prodNetworks: NetworkConfig[] = [
  {
    ...mainnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_MAINNET_API_URL] } },
    contracts: { ...mainnet.contracts, ...p2pix(mainnet) },
    tokens: { BRZ: { address: import.meta.env.VITE_MAINNET_TOKEN_ADDRESS } },
    subgraphUrls: [import.meta.env.VITE_MAINNET_SUBGRAPH_URL],
  },
  {
    ...arbitrum,
    rpcUrls: { default: { http: [import.meta.env.VITE_ARBITRUM_API_URL] } },
    contracts: { ...arbitrum.contracts, ...p2pix(arbitrum) },
    tokens: { BRZ: { address: import.meta.env.VITE_ARBITRUM_TOKEN_ADDRESS } },
    subgraphUrls: [import.meta.env.VITE_ARBITRUM_SUBGRAPH_URL],
  },
];

const testNetworks: NetworkConfig[] = [
  {
    ...sepolia,
    rpcUrls: { default: { http: [import.meta.env.VITE_SEPOLIA_API_URL] } },
    contracts: { ...sepolia.contracts, ...p2pix(sepolia) },
    tokens: {
      BRZ: { address: deployments(sepolia.id)['MockToken#MockToken'] },
    },
    subgraphUrls: [import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL],
  },
  {
    ...rootstockTestnet,
    rpcUrls: { default: { http: [import.meta.env.VITE_RSK_API_URL] } },
    contracts: { ...rootstockTestnet.contracts, ...p2pix(rootstockTestnet) },
    tokens: {
      BRZ: { address: deployments(rootstockTestnet.id)['MockToken#MockToken'] },
    },
    subgraphUrls: [import.meta.env.VITE_RSK_SUBGRAPH_URL],
  },
];

export const Networks: NetworkConfig[] = import.meta.env.PROD
  ? prodNetworks
  : testNetworks;

export const DEFAULT_NETWORK = Networks[0];

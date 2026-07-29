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

// prettier-ignore
const prodNetworks: NetworkConfig[] = [
  {
    ...mainnet,
    rpcUrls: { default: { http: ['https://eth-mainnet.g.alchemy.com/v2/LgaUspQXUtbBxAF8qApKG8L5-FesOVLH'] } },
    contracts: { ...mainnet.contracts, ...p2pix(mainnet) },
    tokens: { BRZ: { address: '0xC40356e14842e951A2A1F156d5be28cC6E4C2697' } },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/mainnet/p2pix'],
  },
  {
    ...arbitrum,
    rpcUrls: { default: { http: ['https://arb-mainnet.g.alchemy.com/v2/Ypckt5vbPFn6Knfwyfai0DevHqw8ukJl'] } },
    contracts: { ...arbitrum.contracts, ...p2pix(arbitrum) },
    tokens: { BRZ: { address: '0xa8940698fda5a07abaef4a5ccdf2f1bb525b47a2' } },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/arbitrum/p2pix'],
  },
];

// prettier-ignore
const testNetworks: NetworkConfig[] = [
  {
    ...sepolia,
    rpcUrls: { default: { http: ['https://eth-sepolia.g.alchemy.com/v2/LgaUspQXUtbBxAF8qApKG8L5-FesOVLH'] } },
    contracts: { ...sepolia.contracts, ...p2pix(sepolia) },
    tokens: { BRZ: { address: deployments(sepolia.id)['MockToken#MockToken'] } },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/p-2-pix/sepolia'],
  },
  {
    ...rootstockTestnet,
    rpcUrls: { default: { http: ['https://rootstock-testnet.g.alchemy.com/v2/dHLGA_JZ4cW83ZB23SBhCCqys3niIUDv'] } },
    contracts: { ...rootstockTestnet.contracts, ...p2pix(rootstockTestnet) },
    tokens: { BRZ: { address: deployments(rootstockTestnet.id)['MockToken#MockToken'] } },
    subgraphUrls: ['https://api.studio.thegraph.com/query/113713/p-2-pix/version/rootstock-testnet'],
  },
];

export const Networks: NetworkConfig[] = import.meta.env.PROD
  ? prodNetworks
  : testNetworks;

export const DEFAULT_NETWORK = Networks[0];

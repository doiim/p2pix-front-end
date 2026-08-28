import type { Address, Chain } from 'viem';
import { arbitrum, mainnet, rootstockTestnet, sepolia } from 'viem/chains';
import type { AppKitNetwork as WalletNetwork } from '@doiim/reown-appkit/networks';
import { NetworkConfig } from '@/model/NetworkEnum';

export type { WalletNetwork };

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
const prodNetworks: [NetworkConfig, ...NetworkConfig[]] = [
  {
    ...mainnet,
    rpcUrls: { default: { http: ['https://eth-mainnet.g.alchemy.com/v2/LgaUspQXUtbBxAF8qApKG8L5-FesOVLH'] } },
    contracts: { ...mainnet.contracts, ...p2pix(mainnet) },
    tokens: { BRZ: { address: '0xC40356e14842e951A2A1F156d5be28cC6E4C2697' } },
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/1/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e' },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/mainnet/p2pix'],
  },
  {
    ...arbitrum,
    rpcUrls: { default: { http: ['https://arb-mainnet.g.alchemy.com/v2/Ypckt5vbPFn6Knfwyfai0DevHqw8ukJl'] } },
    contracts: { ...arbitrum.contracts, ...p2pix(arbitrum) },
    tokens: { BRZ: { address: '0xa8940698fda5a07abaef4a5ccdf2f1bb525b47a2' } },
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/42161/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e' },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/arbitrum/p2pix'],
  },
];

// prettier-ignore
const testNetworks: [NetworkConfig, ...NetworkConfig[]] = [
  {
    ...sepolia,
    rpcUrls: { default: { http: ['https://eth-sepolia.g.alchemy.com/v2/LgaUspQXUtbBxAF8qApKG8L5-FesOVLH'] } },
    contracts: { ...sepolia.contracts, ...p2pix(sepolia) },
    tokens: { BRZ: { address: deployments(sepolia.id)['MockToken#MockToken'] } },
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e' },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/p-2-pix/sepolia'],
  },
  {
    ...rootstockTestnet,
    rpcUrls: { default: { http: ['https://rootstock-testnet.g.alchemy.com/v2/dHLGA_JZ4cW83ZB23SBhCCqys3niIUDv'] } },
    contracts: { ...rootstockTestnet.contracts, ...p2pix(rootstockTestnet) },
    tokens: { BRZ: { address: deployments(rootstockTestnet.id)['MockToken#MockToken'] } },
    // No `aa` here: Pimlico serves no Rootstock network, so a bundler URL built
    // for this chain id would be accepted by isAaAvailable and then rejected at
    // send time. Leaving AA off keeps passkey login from being offered at all.
    // https://dashboard.pimlico.io/request-chain-deployment
    subgraphUrls: ['https://api.studio.thegraph.com/query/113713/p-2-pix/version/rootstock-testnet'],
  },
];

export const Networks =
  import.meta.env.VITE_APP_ENV === 'production' ? prodNetworks : testNetworks;

export const DEFAULT_NETWORK = Networks[0];

/** Network list handed to AppKit / the wagmi adapter (see config/appkit.ts).
 * Note: NetworkConfig extends Chain with extra fields (tokens, aa).
 * AppKit uses the Chain subset; extra fields are harmless but not used. */
export const wagmiNetworks: [WalletNetwork, ...WalletNetwork[]] = Networks;

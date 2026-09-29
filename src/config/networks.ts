import type { Address } from 'viem';
import { arbitrum, mainnet, sepolia } from 'viem/chains';
import type { AppKitNetwork as WalletNetwork } from '@doiim/reown-appkit/networks';
import { NetworkConfig } from '@/model/NetworkEnum';

export type { WalletNetwork };

// Contract addresses come from the contracts repo's deploys/<name>.json.
const deploys = import.meta.glob<{ p2pix: Address; token: Address }>(
  './*.json',
  { eager: true, import: 'default', base: '/p2pix-smart-contracts/deploys' },
);
const record = (name: string) => deploys[`./${name}.json`];
const p2pix = (name: string) => ({ p2pix: { address: record(name)?.p2pix } });

const ifWired = (
  name: string,
  network: NetworkConfig,
): NetworkConfig | undefined => (record(name)?.p2pix ? network : undefined);

// prettier-ignore
const prodNetworks = [
  ifWired('mainnet', {
    ...mainnet,
    rpcUrls: { default: { http: ['https://eth-mainnet.g.alchemy.com/v2/LgaUspQXUtbBxAF8qApKG8L5-FesOVLH'] } },
    contracts: { ...mainnet.contracts, ...p2pix('mainnet') },
    tokens: { BRZ: { address: '0xC40356e14842e951A2A1F156d5be28cC6E4C2697' } },
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/1/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e' },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/mainnet/p2pix'],
  }),
  ifWired('arbitrum', {
    ...arbitrum,
    rpcUrls: { default: { http: ['https://arb-mainnet.g.alchemy.com/v2/Ypckt5vbPFn6Knfwyfai0DevHqw8ukJl'] } },
    contracts: { ...arbitrum.contracts, ...p2pix('arbitrum') },
    tokens: { BRZ: { address: '0xa8940698fda5a07abaef4a5ccdf2f1bb525b47a2' } },
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/42161/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e' },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/arbitrum/p2pix'],
  }),
];

// prettier-ignore
const testNetworks = [
  ifWired('sepolia', {
    ...sepolia,
    rpcUrls: { default: { http: ['https://eth-sepolia.g.alchemy.com/v2/LgaUspQXUtbBxAF8qApKG8L5-FesOVLH'] } },
    contracts: { ...sepolia.contracts, ...p2pix('sepolia') },
    tokens: { BRZ: { address: record('sepolia')?.token } },
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/11155111/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e' },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1745314/p-2-pix/sepolia'],
  }),
];

const isProd = import.meta.env.VITE_APP_ENV === 'production';
const wired = (isProd ? prodNetworks : testNetworks).filter(
  (network): network is NetworkConfig => network !== undefined,
);

if (wired.length === 0)
  throw new Error(
    '[networks] no wired deployments for this environment; check the contracts submodule deploys/*.json',
  );

export const Networks = wired as [NetworkConfig, ...NetworkConfig[]];

export const DEFAULT_NETWORK = Networks[0];

/** Network list handed to AppKit / the wagmi adapter (see config/appkit.ts).
 * Note: NetworkConfig extends Chain with extra fields (tokens, aa).
 * AppKit uses the Chain subset; extra fields are harmless but not used. */
export const wagmiNetworks: [WalletNetwork, ...WalletNetwork[]] = Networks;

import type { Address } from 'viem';
import { arbitrum, mainnet, sepolia } from 'viem/chains';
import type { NetworkConfig } from '@/model/NetworkEnum';

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
    aa: { bundlerUrl: 'https://api.pimlico.io/v2/42161/rpc?apikey=pim_MQjrtKPAPnQ2oyfvyr128e', sponsorSweep: true },
    subgraphUrls: ['https://api.studio.thegraph.com/query/1763496/p-2-pix-arthur/arbitrum'],
    // Settlement: cowprotocol/contracts networks.json. USDC: Circle's address
    // list. USDT: docs.usdt0.to deployments ("Token", on-chain symbol USD₮0).
    // DAI: MakerDAO's official Arbitrum bridge token.
    // The first token is the one the UI preselects.
    swap: {
      apiUrl: 'https://api.cow.fi/arbitrum_one',
      settlement: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
      tokens: [
        { symbol: 'USDT', name: 'Tether USD', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
        { symbol: 'USDC', name: 'USD Coin', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
        { symbol: 'DAI', name: 'Dai Stablecoin', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
      ],
    },
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
    subgraphUrls: ['https://api.studio.thegraph.com/query/1763496/p-2-pix-arthur/sepolia'],
    // Test only. CoW's Sepolia solvers read the testnet Uniswap V2 fork
    // (factory 0xc9f18c25…e978), where the MockBRZ/WETH pair 0x802c967F…E39c
    // was seeded for this. USDC: Circle's Sepolia token, routed via WETH.
    swap: {
      apiUrl: 'https://api.cow.fi/sepolia',
      settlement: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
      tokens: [
        { symbol: 'USDC', name: 'USD Coin', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238' },
        { symbol: 'WETH', name: 'Wrapped Ether', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14' },
      ],
    },
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

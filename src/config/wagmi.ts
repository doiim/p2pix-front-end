import { createAppKit } from '@reown/appkit/vue';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { Networks, wagmiNetworks } from '@/config/networks';

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string;

export const wagmiAdapter = new WagmiAdapter({
  networks: wagmiNetworks,
  projectId,
});

createAppKit({
  adapters: [wagmiAdapter],
  networks: wagmiNetworks,
  defaultNetwork: Networks.sepolia,
  projectId,
  metadata: {
    name: 'P2Pix',
    description: 'P2P token exchange via Pix',
    url: 'https://p2pix.co',
    icons: ['/p2pix.svg'],
  },
  features: {
    email: true,
    socials: ['google', 'github', 'apple', 'x'],
    emailShowWallets: true,
    swaps: false,
    onramp: false,
    analytics: true,
  },
});

export const getWagmiConfig = () => wagmiAdapter.wagmiConfig;

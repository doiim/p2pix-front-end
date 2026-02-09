import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import {
  sepolia,
  rootstockTestnet,
  type AppKitNetwork,
} from "@reown/appkit/networks";

const projectId = import.meta.env.VITE_REOWN_PROJECT_ID as string;

const networks: [AppKitNetwork, ...AppKitNetwork[]] = [
  sepolia,
  rootstockTestnet,
];

export const wagmiAdapter = new WagmiAdapter({
  networks,
  projectId,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export { networks as appKitNetworks };

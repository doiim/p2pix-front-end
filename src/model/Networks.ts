import { NetworkEnum } from "@/model/NetworkEnum";

export interface NetworkConfig {
  chainId: string;
  chainName: string;
  token: string;
  rpcUrl?: string;
  blockExplorerUrl?: string;
}

export const Networks: { [key in NetworkEnum]: NetworkConfig } = {
  [NetworkEnum.sepolia]: {
    chainId: "0xAA36A7",
    chainName: "Sepolia Testnet",
    token: "ETH",
    rpcUrl: import.meta.env.VITE_SEPOLIA_API_URL,
    blockExplorerUrl: "https://sepolia.etherscan.io",
  },
  [NetworkEnum.rootstock]: {
    chainId: "0x1F",
    chainName: "Rootstock Testnet",
    token: "tRBTC",
    rpcUrl: import.meta.env.VITE_ROOTSTOCK_API_URL,
    blockExplorerUrl: "https://explorer.testnet.rsk.co",
  },
};

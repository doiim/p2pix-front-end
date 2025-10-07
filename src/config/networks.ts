import { NetworkEnum } from "@/model/NetworkEnum";
import { sepolia, rootstockTestnet, type Chain } from "viem/chains";

export interface NetworkConfig {
  id: NetworkEnum;
  chainId: string;
  chainName: string;
  token: string;
  rpcUrl: string;
  blockExplorerUrl: string;
  iconPath: string;
  viemChain: Chain;
  contracts: {
    p2pixAddress: string;
    tokenAddresses: Record<string, string>;
  };
}

export const NETWORK_CONFIGS: Record<NetworkEnum, NetworkConfig> = {
  [NetworkEnum.sepolia]: {
    id: NetworkEnum.sepolia,
    chainId: "0xAA36A7",
    chainName: "Sepolia Testnet",
    token: "ETH",
    rpcUrl: import.meta.env.VITE_SEPOLIA_API_URL,
    blockExplorerUrl: "https://sepolia.etherscan.io",
    iconPath: "/ethereum.svg",
    viemChain: sepolia,
    contracts: {
      p2pixAddress: "0xb7cD135F5eFD9760981e02E2a898790b688939fe",
      tokenAddresses: {
        BRZ: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
      },
    },
  },
  [NetworkEnum.rootstock]: {
    id: NetworkEnum.rootstock,
    chainId: "0x1F",
    chainName: "Rootstock Testnet",
    token: "tRBTC",
    rpcUrl: import.meta.env.VITE_ROOTSTOCK_API_URL,
    blockExplorerUrl: "https://explorer.testnet.rsk.co",
    iconPath: "/rootstock.svg",
    viemChain: rootstockTestnet,
    contracts: {
      p2pixAddress: "0x57Dcba05980761169508886eEdc6f5E7EC0411Dc",
      tokenAddresses: {
        BRZ: "0xfE841c74250e57640390f46d914C88d22C51e82e",
      },
    },
  },
};

export const DEFAULT_NETWORK = NetworkEnum.sepolia;

export const ENABLED_NETWORKS: NetworkEnum[] = [
  NetworkEnum.sepolia,
  NetworkEnum.rootstock,
];

export const getNetworkConfig = (networkId: NetworkEnum): NetworkConfig => {
  return NETWORK_CONFIGS[networkId];
};

export const getEnabledNetworks = (): NetworkConfig[] => {
  return ENABLED_NETWORKS.map(id => NETWORK_CONFIGS[id]);
};

export const isNetworkEnabled = (networkId: NetworkEnum): boolean => {
  return ENABLED_NETWORKS.includes(networkId);
};

export const getNetworkByChainId = (chainId: string): NetworkConfig | null => {
  const network = Object.values(NETWORK_CONFIGS).find(
    config => config.chainId === chainId
  );
  return network || null;
};

export const getContractAddress = (
  networkId: NetworkEnum,
  contractType: 'p2pix' | string
): string => {
  const config = getNetworkConfig(networkId);
  
  if (contractType === 'p2pix') {
    return config.contracts.p2pixAddress;
  }
  
  return config.contracts.tokenAddresses[contractType] || '';
};

export const getRpcUrl = (networkId: NetworkEnum): string => {
  return getNetworkConfig(networkId).rpcUrl;
};

export const getBlockExplorerUrl = (networkId: NetworkEnum): string => {
  return getNetworkConfig(networkId).blockExplorerUrl;
};

export const getViemChain = (networkId: NetworkEnum): Chain => {
  return getNetworkConfig(networkId).viemChain;
};

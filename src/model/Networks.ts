import { NetworkEnum } from "@/model/NetworkEnum";
import { getNetworkConfig } from "@/config/networks";

export interface NetworkConfig {
  chainId: string;
  chainName: string;
  token: string;
  rpcUrl?: string;
  blockExplorerUrl?: string;
}

// Mapeamento para compatibilidade com código existente
export const Networks: { [key in NetworkEnum]: NetworkConfig } = {
  [NetworkEnum.sepolia]: {
    chainId: getNetworkConfig(NetworkEnum.sepolia).chainId,
    chainName: getNetworkConfig(NetworkEnum.sepolia).chainName,
    token: getNetworkConfig(NetworkEnum.sepolia).token,
    rpcUrl: getNetworkConfig(NetworkEnum.sepolia).rpcUrl,
    blockExplorerUrl: getNetworkConfig(NetworkEnum.sepolia).blockExplorerUrl,
  },
  [NetworkEnum.rootstock]: {
    chainId: getNetworkConfig(NetworkEnum.rootstock).chainId,
    chainName: getNetworkConfig(NetworkEnum.rootstock).chainName,
    token: getNetworkConfig(NetworkEnum.rootstock).token,
    rpcUrl: getNetworkConfig(NetworkEnum.rootstock).rpcUrl,
    blockExplorerUrl: getNetworkConfig(NetworkEnum.rootstock).blockExplorerUrl,
  },
};

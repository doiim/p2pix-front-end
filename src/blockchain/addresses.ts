import { useUser } from "@/composables/useUser";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { createPublicClient, http, type Address } from "viem";
import { getContractAddress, getRpcUrl, getNetworkConfig, getViemChain } from "@/config/networks";

export const getTokenByAddress = (address: Address) => {
  const user = useUser();
  const networkConfig = getNetworkConfig(user.networkName.value);

  for (const [token, tokenAddress] of Object.entries(networkConfig.contracts.tokenAddresses)) {
    if (tokenAddress.toLowerCase() === address.toLowerCase()) {
      return token;
    }
  }
  return null;
};

export const getTokenAddress = (
  token: TokenEnum,
  network?: NetworkEnum
): Address => {
  const user = useUser();
  const networkId = network ? network : user.networkName.value;
  
  const tokenAddress = getContractAddress(networkId, token);
  return tokenAddress as Address;
};

export const getP2PixAddress = (network?: NetworkEnum): Address => {
  const user = useUser();
  const networkId = network ? network : user.networkName.value;
  
  const p2pixAddress = getContractAddress(networkId, 'p2pix');
  return p2pixAddress as Address;
};

export const getProviderUrl = (network?: NetworkEnum): string => {
  const user = useUser();
  const networkId = network || user.networkName.value;
  
  return getRpcUrl(networkId);
};

export const getProviderByNetwork = (network: NetworkEnum) => {
  const chain = getViemChain(network);
  return createPublicClient({
    chain,
    transport: http(getProviderUrl(network)),
  });
};

export const isPossibleNetwork = (networkChain: NetworkEnum): boolean => {
  return Number(networkChain) in NetworkEnum;
};

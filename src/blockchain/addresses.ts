import { useViemStore } from "@/store/viem";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { createPublicClient, http } from "viem";
import { sepolia, rootstock } from "viem/chains";

const Tokens: { [key in NetworkEnum]: { [key in TokenEnum]: string } } = {
  [NetworkEnum.sepolia]: {
    BRZ: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
    // BRX: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
  },
  [NetworkEnum.rootstock]: {
    BRZ: "0xfE841c74250e57640390f46d914C88d22C51e82e",
    // BRX: "0xfE841c74250e57640390f46d914C88d22C51e82e",
  },
};

export const getTokenByAddress = (address: string) => {
  const viemStore = useViemStore();
  const networksTokens = Tokens[viemStore.networkName];
  for (const [token, tokenAddress] of Object.entries(networksTokens)) {
    if (tokenAddress.toLowerCase() === address.toLowerCase()) {
      return token;
    }
  }
  return null;
};

export const getTokenAddress = (
  token: TokenEnum,
  network?: NetworkEnum
): string => {
  const viemStore = useViemStore();
  return Tokens[network ? network : viemStore.networkName][token];
};

export const getP2PixAddress = (network?: NetworkEnum): string => {
  const viemStore = useViemStore();
  const possibleP2PixAddresses: { [key in NetworkEnum]: string } = {
    [NetworkEnum.sepolia]: "0x2414817FF64A114d91eCFA16a834d3fCf69103d4",
    [NetworkEnum.rootstock]: "0x98ba35eb14b38D6Aa709338283af3e922476dE34",
  };

  return possibleP2PixAddresses[network ? network : viemStore.networkName];
};

export const getProviderUrl = (network?: NetworkEnum): string => {
  const viemStore = useViemStore();
  const possibleProvidersUrls: { [key in NetworkEnum]: string } = {
    [NetworkEnum.sepolia]: import.meta.env.VITE_SEPOLIA_API_URL,
    [NetworkEnum.rootstock]: import.meta.env.VITE_RSK_API_URL,
  };

  return possibleProvidersUrls[network || viemStore.networkName];
};

export const getProviderByNetwork = (network: NetworkEnum) => {
  console.log("network", network);
  const chain = network === NetworkEnum.sepolia ? sepolia : rootstock;
  return createPublicClient({
    chain,
    transport: http(getProviderUrl(network))
  });
};

export const isPossibleNetwork = (networkChain: NetworkEnum): boolean => {
  return Number(networkChain) in NetworkEnum;
};


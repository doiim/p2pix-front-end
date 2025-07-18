import { useUser } from "@/composables/useUser";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { createPublicClient, http, type Address } from "viem";
import { sepolia, rootstockTestnet } from "viem/chains";

const Tokens: { [key in NetworkEnum]: { [key in TokenEnum]: Address } } = {
  [NetworkEnum.sepolia]: {
    BRZ: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
    // BRX: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
  },
  [NetworkEnum.rootstock]: {
    BRZ: "0xfE841c74250e57640390f46d914C88d22C51e82e",
    // BRX: "0xfE841c74250e57640390f46d914C88d22C51e82e",
  },
};

export const getTokenByAddress = (address: Address) => {
  const user = useUser();
  const networksTokens = Tokens[user.networkName.value];
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
): Address => {
  const user = useUser();
  return Tokens[network ? network : user.networkName.value][
    token
  ];
};

export const getP2PixAddress = (network?: NetworkEnum): Address => {
  const user = useUser();
  const possibleP2PixAddresses: { [key in NetworkEnum]: Address } = {
    [NetworkEnum.sepolia]: "0xb7cD135F5eFD9760981e02E2a898790b688939fe",
    [NetworkEnum.rootstock]: "0x98ba35eb14b38D6Aa709338283af3e922476dE34",
  };

  return possibleP2PixAddresses[
    network ? network : user.networkName.value
  ];
};

export const getProviderUrl = (network?: NetworkEnum): string => {
  const user = useUser();
  const possibleProvidersUrls: { [key in NetworkEnum]: string } = {
    [NetworkEnum.sepolia]: import.meta.env.VITE_SEPOLIA_API_URL,
    [NetworkEnum.rootstock]: import.meta.env.VITE_RSK_API_URL,
  };

  return possibleProvidersUrls[network || user.networkName.value];
};

export const getProviderByNetwork = (network: NetworkEnum) => {
  const chain = network === NetworkEnum.sepolia ? sepolia : rootstockTestnet;
  return createPublicClient({
    chain,
    transport: http(getProviderUrl(network)),
  });
};

export const isPossibleNetwork = (networkChain: NetworkEnum): boolean => {
  return Number(networkChain) in NetworkEnum;
};

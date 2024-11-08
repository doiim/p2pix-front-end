import { useEtherStore } from "@/store/ether";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { JsonRpcProvider } from "ethers";

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
  for (const network of Object.values(NetworkEnum).filter(
    (v) => !isNaN(Number(v))
  )) {
    for (const token of Object.keys(Tokens[network as NetworkEnum])) {
      if (address === Tokens[network as NetworkEnum][token as TokenEnum]) {
        return token as TokenEnum;
      }
    }
  }

  return null;
};

const getTokenAddress = (token: TokenEnum, network?: NetworkEnum): string => {
  const etherStore = useEtherStore();
  return Tokens[network ? network : etherStore.networkName][token];
};

const getP2PixAddress = (network?: NetworkEnum): string => {
  const etherStore = useEtherStore();
  const possibleP2PixAddresses: { [key in NetworkEnum]: string } = {
    [NetworkEnum.sepolia]: "0xb7cD135F5eFD9760981e02E2a898790b688939fe",
    [NetworkEnum.rootstock]: "0x98ba35eb14b38D6Aa709338283af3e922476dE34",
  };

  return possibleP2PixAddresses[network ? network : etherStore.networkName];
};

const getProviderUrl = (network?: NetworkEnum): string => {
  const etherStore = useEtherStore();
  const possibleProvidersUrls: { [key in NetworkEnum]: string } = {
    [NetworkEnum.sepolia]: import.meta.env.VITE_SEPOLIA_API_URL,
    [NetworkEnum.rootstock]: import.meta.env.VITE_RSK_API_URL,
  };

  return possibleProvidersUrls[network || etherStore.networkName];
};

const getProviderByNetwork = (network: NetworkEnum): JsonRpcProvider => {
  console.log("network", network);
  return new JsonRpcProvider(getProviderUrl(network), network);
};

const isPossibleNetwork = (networkChain: NetworkEnum): boolean => {
  return Number(networkChain) in NetworkEnum;
};

export {
  getTokenAddress,
  getProviderUrl,
  isPossibleNetwork,
  getP2PixAddress,
  getProviderByNetwork,
};

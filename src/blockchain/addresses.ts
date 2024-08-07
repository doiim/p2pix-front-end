import { useEtherStore } from "@/store/ether";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";

const ethereumTokens: { [key in TokenEnum]: string } = {
  BRZ: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
  BRX: "0x3eBE67A2C7bdB2081CBd34ba3281E90377462289",
}

const polygonTokens: { [key in TokenEnum]: string } = {
  BRZ: "0xC86042E9F2977C62Da8c9dDF7F9c40fde4796A29",
  BRX: "0xC86042E9F2977C62Da8c9dDF7F9c40fde4796A29",
}

const rootstockTokens: { [key in TokenEnum]: string } = {
  BRZ: "0xfE841c74250e57640390f46d914C88d22C51e82e",
  BRX: "0xfE841c74250e57640390f46d914C88d22C51e82e",
}

export const getTokenByAddress = (address: string) => {
  for (const token of Object.keys(ethereumTokens)) {
    if (address === ethereumTokens[token as TokenEnum]) {
      return token as TokenEnum;
    }
  }

  for (const token of Object.keys(polygonTokens)) {
    if (address === ethereumTokens[token as TokenEnum]) {
      return token as TokenEnum;
    }
  }

  for (const token of Object.keys(rootstockTokens)) {
    if (address === ethereumTokens[token as TokenEnum]) {
      return token as TokenEnum;
    }
  }

  return null;
}

const getTokenAddress = (token: TokenEnum, network?: NetworkEnum): string => {
  const etherStore = useEtherStore();

  const possibleTokenAddresses: { [key: string]: { [key in TokenEnum]: string } } = {
    Ethereum: ethereumTokens,
    Polygon: polygonTokens,
    Rootstock: rootstockTokens,
  };

  return possibleTokenAddresses[network ? network : etherStore.networkName][token];
};

const getP2PixAddress = (network?: NetworkEnum): string => {
  const etherStore = useEtherStore();

  const possibleP2PixAddresses: { [key: string]: string } = {
    Ethereum: "0xb7cD135F5eFD9760981e02E2a898790b688939fe",
    Polygon: "0x4A2886EAEc931e04297ed336Cc55c4eb7C75BA00",
    Rootstock: "0x98ba35eb14b38D6Aa709338283af3e922476dE34",
  };

  return possibleP2PixAddresses[network ? network : etherStore.networkName];
};

const getProviderUrl = (): string => {
  const etherStore = useEtherStore();
  const possibleProvidersUrls: { [key: string]: string } = {
    Ethereum: import.meta.env.VITE_SEPOLIA_API_URL,
    Polygon: import.meta.env.VITE_MUMBAI_API_URL,
    Rootstock: import.meta.env.VITE_RSK_API_URL,
  };

  return possibleProvidersUrls[etherStore.networkName];
};

const possibleChains: { [key: string]: NetworkEnum } = {
  "11155111": NetworkEnum.ethereum,
  "80001": NetworkEnum.polygon,
  "31": NetworkEnum.rootstock,
};

const network2Chain: { [key: string]: string } = {
  Ethereum: "0xAA36A7",
  Polygon: "0x13881",
  Localhost: "0x7a69",
  Rootstock: "0x1f",
};

const isPossibleNetwork = (networkChain: string): boolean => {
  if (Object.keys(possibleChains).includes(networkChain.toString())) {
    return true;
  }
  return false;
};

export {
  getTokenAddress,
  getProviderUrl,
  possibleChains,
  network2Chain,
  isPossibleNetwork,
  getP2PixAddress,
};

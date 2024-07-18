import { useEtherStore } from "@/store/ether";
import { NetworkEnum } from "@/model/NetworkEnum";

const getTokenAddress = (network?: NetworkEnum): string => {
  const etherStore = useEtherStore();

  const possibleTokenAddresses: { [key: string]: string } = {
    Ethereum: "0x4A2886EAEc931e04297ed336Cc55c4eb7C75BA00",
    Polygon: "0xC86042E9F2977C62Da8c9dDF7F9c40fde4796A29",
  };

  return possibleTokenAddresses[network ? network : etherStore.networkName];
};

const getP2PixAddress = (network?: NetworkEnum): string => {
  const etherStore = useEtherStore();

  const possibleP2PixAddresses: { [key: string]: string } = {
    Ethereum: "0x2414817FF64A114d91eCFA16a834d3fCf69103d4",
    Polygon: "0x4A2886EAEc931e04297ed336Cc55c4eb7C75BA00",
  };

  return possibleP2PixAddresses[network ? network : etherStore.networkName];
};

const getProviderUrl = (): string => {
  const etherStore = useEtherStore();

  const possibleProvidersUrls: { [key: string]: string } = {
    Ethereum: import.meta.env.VITE_GOERLI_API_URL,
    Polygon: import.meta.env.VITE_MUMBAI_API_URL,
  };

  return possibleProvidersUrls[etherStore.networkName];
};

const possibleChains: { [key: string]: NetworkEnum } = {
  "0x5": NetworkEnum.ethereum,
  "5": NetworkEnum.ethereum,
  "0x13881": NetworkEnum.polygon,
  "80001": NetworkEnum.polygon,
};

const network2Chain: { [key: string]: string } = {
  Ethereum: "0x5",
  Polygon: "0x13881",
  Localhost: "0x7a69",
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

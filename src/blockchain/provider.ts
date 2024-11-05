import { useEtherStore } from "@/store/ether";
import p2pix from "@/utils/smart_contract_files/P2PIX.json";

import { updateWalletStatus } from "./wallet";
import {
  getProviderUrl,
  isPossibleNetwork,
  getP2PixAddress,
} from "./addresses";

import type { NetworkEnum } from "@/model/NetworkEnum";
import { Networks } from "@/model/Networks";

import { BrowserProvider, JsonRpcProvider, Contract } from "ethers";

const getProvider = (
  onlyAlchemyProvider: boolean = false
): BrowserProvider | JsonRpcProvider => {
  if (onlyAlchemyProvider) return new JsonRpcProvider(getProviderUrl()); // alchemy provider
  return (window as any).ethereum as BrowserProvider;
};

const getContract = async (onlyAlchemyProvider: boolean = false) => {
  const provider = getProvider(onlyAlchemyProvider);
  const signer = await provider.getSigner();
  return new Contract(getP2PixAddress(), p2pix.abi, signer);
};

const connectProvider = async (): Promise<void> => {
  const window_ = window as any;
  const connection = window_.ethereum;
  const provider = getProvider();
  await (provider as any).enable();
  if (!(provider instanceof BrowserProvider)) {
    window.alert("Please, connect to metamask extension");
    return;
  }

  await updateWalletStatus();

  listenToNetworkChange(connection);
  listenToWalletChange(connection);
};

const listenToWalletChange = (connection: any): void => {
  connection.on("accountsChanged", async () => {
    console.log("Changed account!");
    updateWalletStatus();
  });
};

const listenToNetworkChange = (connection: any) => {
  const etherStore = useEtherStore();

  connection.on("chainChanged", (networkChain: NetworkEnum) => {
    console.log("Changed network!");

    if (isPossibleNetwork(networkChain)) {
      etherStore.setNetworkName(networkChain);
      updateWalletStatus();
    } else {
      window.alert("Invalid chain!");
    }
  });
};

const requestNetworkChange = async (network: NetworkEnum): Promise<boolean> => {
  const etherStore = useEtherStore();
  if (!etherStore.walletAddress) return true;
  const window_ = window as any;

  try {
    await window_.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: Networks[network].chainId }], // chainId must be in hexadecimal numbers
    });
  } catch (e: any) {
    if (e.code == 4902) {
      // Unrecognized chain ID
      await window_.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [Networks[network]],
      });
    }
  }

  return true;
};

export {
  getProvider,
  getContract,
  connectProvider,
  listenToNetworkChange,
  requestNetworkChange,
};

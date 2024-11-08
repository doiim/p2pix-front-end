import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { updateWalletStatus } from "./wallet";
import { getProviderUrl, getP2PixAddress } from "./addresses";
import { BrowserProvider, JsonRpcProvider, Contract } from "ethers";

let provider: BrowserProvider | JsonRpcProvider | null = null;

const getProvider = (onlyAlchemyProvider: boolean = false) => {
  if (onlyAlchemyProvider) return new JsonRpcProvider(getProviderUrl()); // alchemy provider
  return provider;
};

const getContract = async (onlyAlchemyProvider: boolean = false) => {
  const p = getProvider(onlyAlchemyProvider);
  try {
    const signer = await p?.getSigner();
    return new Contract(getP2PixAddress(), p2pix.abi, signer);
  } catch (err) {
    return new Contract(getP2PixAddress(), p2pix.abi, p);
  }
};

const connectProvider = async (p: any): Promise<void> => {
  provider = new BrowserProvider(p, "any");
  await updateWalletStatus();
};
export { getProvider, getContract, connectProvider };

import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { updateWalletStatus } from "./wallet";
import { getProviderUrl, getP2PixAddress } from "./addresses";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { sepolia, rootstock } from "viem/chains";
import { useUser } from "@/composables/useUser";

let publicClient = null;
let walletClient = null;

const getPublicClient = (onlyRpcProvider = false) => {
  if (onlyRpcProvider) {
    const user = useUser();
    const rpcUrl = getProviderUrl();
    return createPublicClient({
      chain: Number(user.networkName.value) === sepolia.id ? sepolia : rootstock,
      transport: http(rpcUrl)
    });
  }
  return publicClient;
};

const getWalletClient = () => {
  return walletClient;
};

const getContract = async (onlyRpcProvider = false) => {
  const client = getPublicClient(onlyRpcProvider);
  const address = getP2PixAddress();
  const abi = p2pix.abi;

  return { address, abi, client };
};

const connectProvider = async (p: any): Promise<void> => {
  console.log("Connecting to provider...");
  const user = useUser();
  const chain = Number(user.networkName.value) === sepolia.id ? sepolia : rootstock;

  publicClient = createPublicClient({
    chain,
    transport: custom(p)
  });

  walletClient = createWalletClient({
    chain,
    transport: custom(p)
  });

  await updateWalletStatus();
};

export { getPublicClient, getWalletClient, getContract, connectProvider };

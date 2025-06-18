import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { updateWalletStatus } from "./wallet";
import { getProviderUrl, getP2PixAddress } from "./addresses";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  PublicClient,
  WalletClient,
} from "viem";
import { sepolia, rootstock } from "viem/chains";
import { useUser } from "@/composables/useUser";

let publicClient: PublicClient | null = null;
let walletClient: WalletClient | null = null;

const getPublicClient: PublicClient | null = (onlyRpcProvider = false) => {
  if (onlyRpcProvider) {
    const user = useUser();
    const rpcUrl = getProviderUrl();
    return createPublicClient({
      chain:
        Number(user.networkName.value) === sepolia.id ? sepolia : rootstock,
      transport: http(rpcUrl),
    });
  }
  return publicClient;
};

const getWalletClient: WalletClient | null = () => {
  return walletClient;
};

const getContract = async (onlyRpcProvider = false) => {
  const client = getPublicClient(onlyRpcProvider);
  const address = getP2PixAddress();
  const abi = p2pix.abi;
  const wallet = getWalletClient();

  const [account] = wallet ? await wallet.getAddresses() : [""];

  return { address, abi, client, wallet, account };
};

const connectProvider = async (p: any): Promise<void> => {
  console.log("Connecting to wallet provider...");
  const user = useUser();
  const chain =
    Number(user.networkName.value) === sepolia.id ? sepolia : rootstock;

  publicClient = createPublicClient({
    chain,
    transport: custom(p),
  });

  const [account] = await p!.request({ method: "eth_requestAccounts" });

  walletClient = createWalletClient({
    account,
    chain,
    transport: custom(p),
  });

  await updateWalletStatus();
};

export { getPublicClient, getWalletClient, getContract, connectProvider };

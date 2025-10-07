import { p2PixAbi } from "./abi";
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
import { useUser } from "@/composables/useUser";
import { getViemChain } from "@/config/networks";

let walletClient: WalletClient | null = null;

const getPublicClient = (): PublicClient => {
    const user = useUser();
    const rpcUrl = getProviderUrl();
    const chain = getViemChain(user.networkName.value);
    
    return createPublicClient({
      chain,
      transport: http(rpcUrl),
    });
};

const getWalletClient = (): WalletClient | null => {
  return walletClient;
};

const getContract = async (onlyRpcProvider = false) => {
  const client = getPublicClient();
  const address = getP2PixAddress();
  const abi = p2PixAbi;
  const wallet = onlyRpcProvider ? null : getWalletClient();

  if (!client) {
    throw new Error("Public client not initialized");
  }

  const [account] = wallet ? await wallet.getAddresses() : [null];

  return { address, abi, client, wallet, account };
};

const connectProvider = async (p: any): Promise<void> => {
  const user = useUser();
  const chain = getViemChain(user.networkName.value);

  const [account] = await p!.request({ method: "eth_requestAccounts" });

  walletClient = createWalletClient({
    account,
    chain,
    transport: custom(p),
  });

  await updateWalletStatus();
};

export { getPublicClient, getWalletClient, getContract, connectProvider };

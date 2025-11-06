import { p2PixAbi } from "./abi";
import { updateWalletStatus } from "./wallet";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  PublicClient,
  WalletClient,
} from "viem";
import { useUser } from "@/composables/useUser";
import type { NetworkConfig } from "@/model/NetworkEnum";
import type { ChainContract } from "viem";

let walletClient: WalletClient | null = null;

const getPublicClient = (): PublicClient => {
    const user = useUser();
    const rpcUrl = (user.network.value as NetworkConfig).rpcUrls.default.http[0];
    const chain = user.network.value;

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
  const user = useUser();
  const address = (user.network.value.contracts?.p2pix as ChainContract).address;
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
  const chain = user.network.value;

  const [account] = await p!.request({ method: "eth_requestAccounts" });

  walletClient = createWalletClient({
    account,
    chain,
    transport: custom(p),
  });

  await updateWalletStatus();
};

export { getPublicClient, getWalletClient, getContract, connectProvider };

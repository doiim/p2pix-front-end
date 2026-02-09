import { p2PixAbi } from "./abi";
import { updateWalletStatus } from "./wallet";
import { 
  getPublicClient as getPublicClientWagmi,
	getTransactionReceipt as getTransactionReceiptWagmi,
	getWalletClient as getWalletClientWagmi,
	switchChain,
	waitForTransactionReceipt,
} from '@wagmi/core';
import { useUser } from "@/composables/useUser";
import type { NetworkConfig } from "@/model/NetworkEnum";
import type { ChainContract, PublicClient, WalletClient } from "viem";
import { wagmiConfig } from "@/config/wagmi";

let walletClient: WalletClient | null = null;

const getPublicClient = () => {
    const user = useUser();
    const rpcUrl = (user.network.value as NetworkConfig).rpcUrls.default.http[0];
    const chain = user.network.value;

    // return createPublicClient({
    //   chain,
    //   transport: http(rpcUrl),
    // });

    return getPublicClientWagmi(wagmiConfig, {
      chainId: chain.id
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

const connectProvider = async (): Promise<void> => {
  const user = useUser();
  const chain = user.network.value;

  walletClient = await getWalletClientWagmi(wagmiConfig, {
    chainId: chain.id
  });

  await updateWalletStatus();
};

export { getPublicClient, getWalletClient, getContract, connectProvider };

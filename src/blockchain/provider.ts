import { p2PixAbi } from "./abi";
import {
  getPublicClient as wagmiGetPublicClient,
  getWalletClient as wagmiGetWalletClient,
} from "@wagmi/core";
import { getWagmiConfig } from "@/config/wagmi";
import { useUser } from "@/composables/useUser";
import type { NetworkConfig } from "@/model/NetworkEnum";
import type { PublicClient, WalletClient } from "viem";
import type { ChainContract } from "viem";

const getPublicClient = (): PublicClient => {
  const user = useUser();
  const chainId = (user.network.value as NetworkConfig).id;
  return wagmiGetPublicClient(getWagmiConfig(), { chainId }) as PublicClient;
};

const getWalletClient = async (): Promise<WalletClient | null> => {
  try {
    const user = useUser();
    const chainId = (user.network.value as NetworkConfig).id;
    return await wagmiGetWalletClient(getWagmiConfig(), { chainId }) as WalletClient;
  } catch {
    return null;
  }
};

const getContract = async (onlyRpcProvider = false) => {
  const client = getPublicClient();
  const user = useUser();
  const address = (user.network.value.contracts?.p2pix as ChainContract).address;
  const abi = p2PixAbi;
  const wallet = onlyRpcProvider ? null : await getWalletClient();

  if (!client) {
    throw new Error("Public client not initialized");
  }

  const [account] = wallet ? await wallet.getAddresses() : [null];

  return { address, abi, client, wallet, account };
};

export { getPublicClient, getWalletClient, getContract };

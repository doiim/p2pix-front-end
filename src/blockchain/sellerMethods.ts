import { getContract, getPublicClient, getWalletClient } from "./provider";
import { getTokenAddress, getP2PixAddress } from "./addresses";
import { parseEther, toHex } from "viem";

import mockToken from "../utils/smart_contract_files/MockToken.json";
import { useViemStore } from "@/store/viem";
import { createParticipant } from "@/utils/bbPay";
import type { Participant } from "@/utils/bbPay";

const approveTokens = async (participant: Participant): Promise<any> => {
  const viemStore = useViemStore();
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();
  
  if (!publicClient || !walletClient) {
    throw new Error("Clients not initialized");
  }
  
  viemStore.setSeller(participant);
  const [account] = await walletClient.getAddresses();
  
  // Get token address
  const tokenAddress = getTokenAddress(viemStore.selectedToken);
  
  // Check if the token is already approved
  const allowance = await publicClient.readContract({
    address: tokenAddress,
    abi: mockToken.abi,
    functionName: 'allowance',
    args: [account, getP2PixAddress()]
  });
  
  if (allowance < parseEther(participant.offer)) {
    // Approve tokens
    const hash = await walletClient.writeContract({
      address: tokenAddress,
      abi: mockToken.abi,
      functionName: 'approve',
      args: [getP2PixAddress(), parseEther(participant.offer)],
      account
    });
    
    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  }
  return true;
};

const addDeposit = async (): Promise<any> => {
  const { address, abi, client } = await getContract();
  const walletClient = getWalletClient();
  const viemStore = useViemStore();
  
  if (!walletClient) {
    throw new Error("Wallet client not initialized");
  }
  
  const [account] = await walletClient.getAddresses();
  
  const sellerId = await createParticipant(viemStore.seller);
  viemStore.setSellerId(sellerId.id);
  
  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'deposit',
    args: [
      sellerId.id,
      toHex("", { size: 32 }),
      getTokenAddress(viemStore.selectedToken),
      parseEther(viemStore.seller.offer),
      true
    ],
    account
  });
  
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt;
};

export { approveTokens, addDeposit };

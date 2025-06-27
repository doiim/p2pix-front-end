import { getContract, getPublicClient, getWalletClient } from "./provider";
import { getTokenAddress, getP2PixAddress } from "./addresses";
import { parseEther, toHex } from "viem";
import { sepolia, rootstock } from "viem/chains";

import mockToken from "../utils/smart_contract_files/MockToken.json";
import { useUser } from "@/composables/useUser";
import { createParticipant } from "@/utils/bbPay";
import type { Participant } from "@/utils/bbPay";

const approveTokens = async (participant: Participant): Promise<any> => {
  const user = useUser();
  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  if (!publicClient || !walletClient) {
    throw new Error("Clients not initialized");
  }

  user.setSeller(participant);
  const [account] = await walletClient.getAddresses();

  // Get token address
  const tokenAddress = getTokenAddress(user.selectedToken.value);

  // Check if the token is already approved
  const allowance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: mockToken.abi,
    functionName: "allowance",
    args: [account, getP2PixAddress()],
  });

  if ((allowance as bigint) < parseEther(participant.offer.toString())) {
    // Approve tokens
    const chain = user.networkId.value === sepolia.id ? sepolia : rootstock;
    const hash = await walletClient.writeContract({
      address: tokenAddress as `0x${string}`,
      abi: mockToken.abi,
      functionName: "approve",
      args: [
        getP2PixAddress() as `0x${string}`,
        parseEther(participant.offer.toString()),
      ],
      account,
      chain,
    });

    await publicClient.waitForTransactionReceipt({ hash });
    return true;
  }
  return true;
};

const addDeposit = async (): Promise<any> => {
  const { address, abi, client } = await getContract();
  const walletClient = getWalletClient();
  const user = useUser();

  if (!walletClient) {
    throw new Error("Wallet client not initialized");
  }

  const [account] = await walletClient.getAddresses();

  const sellerId = await createParticipant(user.seller.value);
  user.setSellerId(sellerId.id);
  if (!sellerId.id) {
    throw new Error("Failed to create participant");
  }
  const chain = user.networkId.value === sepolia.id ? sepolia : rootstock;
  const hash = await walletClient.writeContract({
    address: address as `0x${string}`,
    abi,
    functionName: "deposit",
    args: [
      user.networkId.value + "-" + sellerId.id,
      toHex("", { size: 32 }),
      getTokenAddress(user.selectedToken.value) as `0x${string}`,
      parseEther(user.seller.value.offer.toString()),
      true,
    ],
    account,
    chain,
  });

  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt;
};

export { approveTokens, addDeposit };

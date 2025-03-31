import { getContract, getWalletClient } from "./provider";
import { getTokenAddress } from "./addresses";
import { parseEther, stringToHex, toHex } from "viem";

import type { TokenEnum } from "@/model/NetworkEnum";
import { createSolicitation } from "../utils/bbPay";
import type { Offer } from "../utils/bbPay";

const addLock = async (
  sellerId: string,
  token: string,
  amount: number
): Promise<string> => {
  const { address, abi, client } = await getContract();
  const walletClient = getWalletClient();
  
  if (!walletClient) {
    throw new Error("Wallet client not initialized");
  }
  
  const [account] = await walletClient.getAddresses();
  
  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'lock',
    args: [
      sellerId,
      token,
      parseEther(String(amount)),
      [],
      []
    ],
    account
  });
  
  const receipt = await client.waitForTransactionReceipt({ hash });
  const logs = receipt.logs;
  
  // Extract the lockID from transaction logs
  // This is a simplified approach - in production you'll want more robust log parsing
  const lockId = logs[0].topics[2]; // Simplified - adjust based on actual event structure
  
  const offer: Offer = {
    amount,
    lockId: String(lockId),
    sellerId: sellerId,
  };
  
  await createSolicitation(offer);
  
  return String(lockId);
};

const releaseLock = async (
  pixKey: string,
  amount: number,
  e2eId: string,
  lockId: string
): Promise<any> => {
  const { address, abi, client } = await getContract();
  const walletClient = getWalletClient();
  
  if (!walletClient) {
    throw new Error("Wallet client not initialized");
  }
  
  const [account] = await walletClient.getAddresses();
  
  // In a real implementation, you would get this signature from your backend
  // This is just a placeholder for the mock implementation
  const signature = "0x1234567890";
  
  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'release',
    args: [
      BigInt(lockId),
      toHex(e2eId, { size: 32 }),
      signature
    ],
    account
  });
  
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt;
};

const cancelDeposit = async (depositId: bigint): Promise<any> => {
  const { address, abi, client } = await getContract();
  const walletClient = getWalletClient();
  
  if (!walletClient) {
    throw new Error("Wallet client not initialized");
  }
  
  const [account] = await walletClient.getAddresses();
  
  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'cancelDeposit',
    args: [depositId],
    account
  });
  
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt;
};

const withdrawDeposit = async (
  amount: string,
  token: TokenEnum
): Promise<any> => {
  const { address, abi, client } = await getContract();
  const walletClient = getWalletClient();
  
  if (!walletClient) {
    throw new Error("Wallet client not initialized");
  }
  
  const [account] = await walletClient.getAddresses();
  
  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'withdraw',
    args: [
      getTokenAddress(token),
      parseEther(String(amount)),
      []
    ],
    account
  });
  
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt;
};

export { cancelDeposit, withdrawDeposit, addLock, releaseLock };

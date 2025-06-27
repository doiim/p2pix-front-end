import { getContract } from "./provider";
import { getTokenAddress } from "./addresses";
import { parseEther } from "viem";
import type { TokenEnum } from "@/model/NetworkEnum";

export const addLock = async (
  sellerAddress: string,
  tokenAddress: string,
  amount: number
): Promise<string> => {
  const { address, abi, wallet, client, account } = await getContract();
  const parsedAmount = parseEther(amount.toString());

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const { request } = await client.simulateContract({
    address: address as `0x${string}`,
    abi,
    functionName: "lock",
    args: [sellerAddress, tokenAddress as `0x${string}`, parsedAmount, [], []],
    account: account as `0x${string}`,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return receipt.status === "success" ? receipt.logs[0].topics[2] ?? "" : "";
};

export const withdrawDeposit = async (
  amount: string,
  token: TokenEnum
): Promise<boolean> => {
  const { address, abi, wallet, client, account } = await getContract();

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const tokenAddress = getTokenAddress(token);

  const { request } = await client.simulateContract({
    address: address as `0x${string}`,
    abi,
    functionName: "withdraw",
    args: [tokenAddress as `0x${string}`, parseEther(amount), []],
    account: account as `0x${string}`,
  });

  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return receipt.status === "success";
};

export const releaseLock = async (solicitation: any): Promise<any> => {
  const { address, abi, wallet, client, account } = await getContract();

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const { request } = await client.simulateContract({
    address: address as `0x${string}`,
    abi,
    functionName: "release",
    args: [solicitation.lockId, solicitation.e2eId],
    account: account as `0x${string}`,
  });

  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
};

import { getContract } from "./provider";
import { ChainContract } from "viem";
import {
  parseEther,
  type Address,
  type TransactionReceipt,
} from "viem";

export const addLock = async (
  sellerAddress: Address,
  tokenAddress: Address,
  amount: number
): Promise<bigint> => {
  const { address, abi, wallet, client, account } = await getContract();
  const parsedAmount = parseEther(amount.toString());

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const { result, request } = await client.simulateContract({
    address,
    abi,
    functionName: "lock",
    args: [sellerAddress, tokenAddress, parsedAmount, [], []],
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });

  if (!receipt.status)
    throw new Error("Transaction failed: " + receipt.transactionHash);

  return result;
};

export const withdrawDeposit = async (
  amount: string,
  token: Address
): Promise<boolean> => {
  const { address, abi, wallet, client, account } = await getContract();

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: "withdraw",
    args: [token, parseEther(amount), []],
    account
  });

  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return receipt.status === "success";
};

export const releaseLock = async (
  lockID: bigint,
  pixTimestamp: `0x${string}`&{lenght:34},
  signature: `0x${string}`
): Promise<TransactionReceipt> => {
  const { address, abi, wallet, client, account } = await getContract();

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: "release",
    args: [BigInt(lockID), pixTimestamp, signature],
    account
  });

  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
};

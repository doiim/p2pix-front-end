import { getContract } from "./provider";
import { getTokenAddress } from "./addresses";
import {
  bytesToHex,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  parseEther,
  stringToBytes,
  stringToHex,
  toBytes,
  type Address,
} from "viem";
import type { TokenEnum } from "@/model/NetworkEnum";

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
  token: TokenEnum
): Promise<boolean> => {
  const { address, abi, wallet, client, account } = await getContract();

  if (!wallet) {
    throw new Error("Wallet not connected");
  }

  const tokenAddress = getTokenAddress(token);

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: "withdraw",
    args: [tokenAddress, parseEther(amount), []],
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
): Promise<any> => {
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

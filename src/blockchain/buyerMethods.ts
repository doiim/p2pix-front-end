import { getContract } from "./provider";
import { getTokenAddress } from "./addresses";
import { parseEther } from "viem";
import type { TokenEnum } from "@/model/NetworkEnum";

export const addLock = async (
  sellerAddress: string,
  tokenAddress: string,
  amount: number
): Promise<string> => {
  const { address, abi, wallet, client } = await getContract();
  const parsedAmount = parseEther(amount.toString());

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: "lock",
    args: [sellerAddress, tokenAddress, parsedAmount, [], []],
  });
  console.log(wallet);
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return receipt.status ? receipt.logs[0].topics[2] : "";
};

export const withdrawDeposit = async (
  amount: string,
  token: TokenEnum
): Promise<boolean> => {
  const { address, abi, wallet, client } = await getContract();

  const tokenAddress = getTokenAddress(token);

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: "withdraw",
    args: [tokenAddress, parseEther(amount), []],
  });

  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });

  return receipt.status;
};

export const releaseLock = async (solicitation: any): Promise<any> => {
  const { address, abi, wallet, client } = await getContract();

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: "release",
    args: [solicitation.lockId, solicitation.e2eId],
  });

  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
};

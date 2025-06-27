import { useUser } from "@/composables/useUser";
import { formatEther, toHex, type PublicClient } from "viem";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { getContract } from "./provider";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { getP2PixAddress, getTokenAddress } from "./addresses";
import { getNetworkSubgraphURL, NetworkEnum } from "@/model/NetworkEnum";
import type { UnreleasedLock } from "@/model/UnreleasedLock";

const getNetworksLiquidity = async (): Promise<void> => {
  const user = useUser();
  user.setLoadingNetworkLiquidity(true);

  const depositLists: ValidDeposit[][] = [];

  for (const network of Object.values(NetworkEnum).filter(
    (v) => !isNaN(Number(v))
  )) {
    const deposits = await getValidDeposits(
      getTokenAddress(user.selectedToken.value),
      Number(network)
    );
    if (deposits) depositLists.push(deposits);
  }

  const allDeposits = depositLists.flat();
  user.setDepositsValidList(allDeposits);
  user.setLoadingNetworkLiquidity(false);
};

const getPixKey = async (seller: string, token: string): Promise<string> => {
  const { address, abi, client } = await getContract();

  const pixKeyHex = await client.readContract({
    address: address as `0x${string}`,
    abi,
    functionName: "getPixTarget",
    args: [seller, token],
  });

  // Remove '0x' prefix and convert hex to UTF-8 string
  const hexString =
    typeof pixKeyHex === "string" ? pixKeyHex : toHex(pixKeyHex as bigint);
  if (!hexString) throw new Error("PixKey not found");
  const bytes = new Uint8Array(
    hexString
      .slice(2)
      .match(/.{1,2}/g)!
      .map((byte: string) => parseInt(byte, 16))
  );
  // Remove null bytes from the end of the string
  return new TextDecoder().decode(bytes).replace(/\0/g, "");
};

const getValidDeposits = async (
  token: string,
  network: NetworkEnum,
  contractInfo?: { client: any; address: string }
): Promise<ValidDeposit[]> => {
  let client: PublicClient, abi;

  if (contractInfo) {
    ({ client } = contractInfo);
    abi = p2pix.abi;
  } else {
    ({ abi, client } = await getContract(true));
  }

  // TODO: Remove this once we have a subgraph for rootstock
  if (network === NetworkEnum.rootstock) return [];

  const body = {
    query: `
      {
        depositAddeds(where: { token: "${token}" }) {
          seller
          amount
          blockTimestamp
          blockNumber
        }
      }
  `,
  };

  const depositLogs = await fetch(getNetworkSubgraphURL(network), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  // remove doubles from sellers list
  const depositData = await depositLogs.json();
  const depositAddeds = depositData.data.depositAddeds;
  const uniqueSellers = depositAddeds.reduce(
    (acc: Record<string, boolean>, deposit: any) => {
      acc[deposit.seller] = true;
      return acc;
    },
    {} as Record<string, boolean>
  );

  if (!contractInfo) {
    // Get metamask provider contract
    ({ abi, client } = await getContract(true));
  }

  const depositList: { [key: string]: ValidDeposit } = {};

  const sellersList = Object.keys(uniqueSellers);
  // Use multicall to batch all getBalance requests
  const balanceCalls = sellersList.map((seller) => ({
    address: getP2PixAddress(network) as `0x${string}`,
    abi,
    functionName: "getBalance",
    args: [seller, token],
  }));

  const balanceResults = await client.multicall({
    contracts: balanceCalls as any,
  });

  // Process results into the depositList
  sellersList.forEach((seller, index) => {
    const mappedBalance = balanceResults[index];

    if (!mappedBalance.error && mappedBalance.result) {
      const validDeposit: ValidDeposit = {
        token: token,
        blockNumber: 0,
        remaining: Number(formatEther(mappedBalance.result as bigint)),
        seller: seller,
        network,
        pixKey: "",
      };
      depositList[seller + token] = validDeposit;
    }
  });
  return Object.values(depositList);
};

const getUnreleasedLockById = async (
  lockID: string
): Promise<UnreleasedLock> => {
  const { address, abi, client } = await getContract();

  const lock = await client.readContract({
    address: address as `0x${string}`,
    abi,
    functionName: "mapLocks",
    args: [BigInt(lockID)],
  });

  // Type the lock result as an array (based on the smart contract structure)
  const lockData = lock as [
    bigint,
    string,
    string,
    bigint,
    string,
    string,
    string
  ];
  const amount = formatEther(lockData[3]);

  return {
    lockID: lockID,
    amount: Number(amount),
    tokenAddress: lockData[4] as `0x${string}`,
    sellerAddress: lockData[6] as `0x${string}`,
  };
};

export {
  getValidDeposits,
  getNetworksLiquidity,
  getUnreleasedLockById,
  getPixKey,
};

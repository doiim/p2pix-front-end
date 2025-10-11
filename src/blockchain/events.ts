import { useUser } from "@/composables/useUser";
import { formatEther, toHex, stringToHex } from "viem";
import type { PublicClient, Address } from "viem";
import { Networks } from "@/config/networks";
import { getContract } from "./provider";
import { p2PixAbi } from "./abi"
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { NetworkConfig } from "@/model/NetworkEnum";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import { ChainContract } from "viem";

const getNetworksLiquidity = async (): Promise<void> => {
  const user = useUser();
  user.setLoadingNetworkLiquidity(true);

  const depositLists: ValidDeposit[][] = [];

  for (const network of Object.values(Networks)) {
    const deposits = await getValidDeposits(
      user.network.value.tokens[user.selectedToken.value].address,
      network
    );
    if (deposits) depositLists.push(deposits);
  }

  const allDeposits = depositLists.flat();
  user.setDepositsValidList(allDeposits);
  user.setLoadingNetworkLiquidity(false);
};

const getParticipantID = async (
  seller: Address,
  token: Address
): Promise<string> => {
  const { address, abi, client } = await getContract();

  const participantIDHex = await client.readContract({
    address,
    abi,
    functionName: "getPixTarget",
    args: [seller, token],
  });

  // Remove '0x' prefix and convert hex to UTF-8 string
  const hexString =
    typeof participantIDHex === "string"
      ? participantIDHex
      : toHex(participantIDHex as bigint);
  if (!hexString) throw new Error("Participant ID not found");
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
  token: Address,
  network: NetworkConfig,
  contractInfo?: { client: PublicClient; address: Address }
): Promise<ValidDeposit[]> => {
  let client: PublicClient, abi;

  if (contractInfo) {
    ({ client } = contractInfo);
    abi = p2PixAbi;
  } else {
    ({ abi, client } = await getContract(true));
  }

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

  const depositLogs = await fetch( network.subgraphUrls[0], {
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
    (acc: Record<Address, boolean>, deposit: any) => {
      acc[deposit.seller] = true;
      return acc;
    },
    {} as Record<Address, boolean>
  );

  if (!contractInfo) {
    // Get metamask provider contract
    ({ abi, client } = await getContract(true));
  }

  const depositList: { [key: string]: ValidDeposit } = {};

  const sellersList = Object.keys(uniqueSellers) as Address[];
  // Use multicall to batch all getBalance requests
  const balanceCalls = sellersList.map((seller) => ({
    address: (network.contracts?.p2pix as ChainContract).address,
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
        token,
        blockNumber: 0,
        remaining: Number(formatEther(mappedBalance.result as bigint)),
        seller,
        network,
        participantID: "",
      };
      depositList[seller + token] = validDeposit;
    }
  });
  return Object.values(depositList);
};

const getUnreleasedLockById = async (
  lockID: bigint
): Promise<UnreleasedLock> => {
  const { address, abi, client } = await getContract();

  const [ , , , amount, token, seller ] = await client.readContract({
    address,
    abi,
    functionName: "mapLocks",
    args: [lockID],
  });

  return {
    lockID,
    amount: Number(formatEther(amount)),
    tokenAddress: token,
    sellerAddress: seller,
  };
};

export {
  getValidDeposits,
  getNetworksLiquidity,
  getUnreleasedLockById,
  getParticipantID,
};

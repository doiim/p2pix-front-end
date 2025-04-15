import { useUser } from "@/composables/useUser";
import {
  formatEther,
  decodeEventLog,
  parseAbi,
  toHex,
  type PublicClient,
} from "viem";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { getContract } from "./provider";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { getTokenAddress } from "./addresses";
import { NetworkEnum } from "@/model/NetworkEnum";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

const getNetworksLiquidity = async (): Promise<void> => {
  const user = useUser();
  user.setLoadingNetworkLiquidity(true);

  const depositLists: ValidDeposit[][] = [];

  for (const network of Object.values(NetworkEnum).filter(
    (v) => !isNaN(Number(v))
  )) {
    console.log("getNetworksLiquidity", network);
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
    address,
    abi,
    functionName: "getPixTarget",
    args: [seller, token],
  });

  // Remove '0x' prefix and convert hex to UTF-8 string
  const hexString =
    typeof pixKeyHex === "string" ? pixKeyHex : toHex(pixKeyHex);
  if (!hexString) throw new Error("PixKey not found");
  const bytes = new Uint8Array(
    // @ts-ignore
    hexString
      .slice(2)
      .match(/.{1,2}/g)
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
  let client: PublicClient, address, abi;

  if (contractInfo) {
    ({ client, address } = contractInfo);
    abi = p2pix.abi;
  } else {
    ({ address, abi, client } = await getContract(true));
  }

  const depositLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event DepositAdded(address indexed seller, address token, uint256 amount)",
    ])[0],
    fromBlock: 0n,
    toBlock: "latest",
  });

  if (!contractInfo) {
    // Get metamask provider contract
    ({ address, abi, client } = await getContract());
  }

  const depositList: { [key: string]: ValidDeposit } = {};

  for (const log of depositLogs) {
    try {
      const decoded = decodeEventLog({
        abi,
        data: log.data,
        topics: log.topics,
      });

      // Get liquidity only for the selected token
      if (decoded?.args.token.toLowerCase() !== token.toLowerCase()) continue;

      const mappedBalance = await client.readContract({
        address,
        abi,
        functionName: "getBalance",
        args: [decoded.args.seller, token],
      });

      let validDeposit: ValidDeposit | null = null;

      if (mappedBalance) {
        validDeposit = {
          token: token,
          blockNumber: Number(log.blockNumber),
          remaining: Number(formatEther(mappedBalance)),
          seller: decoded.args.seller,
          network,
          pixKey: "",
        };
      }
      if (validDeposit) depositList[decoded.args.seller + token] = validDeposit;
    } catch (error) {
      console.error("Error decoding log", error);
    }
  }

  return Object.values(depositList);
};

const getUnreleasedLockById = async (
  lockID: string
): Promise<UnreleasedLock> => {
  const { address, abi, client } = await getContract();
  const pixData: Pix = {
    pixKey: "",
  };

  const lock = await client.readContract({
    address,
    abi,
    functionName: "mapLocks",
    args: [BigInt(lockID)],
  });

  const pixTarget = lock.pixTarget;
  const amount = formatEther(lock.amount);
  pixData.pixKey = pixTarget;
  pixData.value = Number(amount);

  return {
    lockID: lockID,
    pix: pixData,
  };
};

export {
  getValidDeposits,
  getNetworksLiquidity,
  getUnreleasedLockById,
  getPixKey,
};

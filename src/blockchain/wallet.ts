import { decodeEventLog, formatEther, type Log, parseAbi } from "viem";
import { useUser } from "@/composables/useUser";

import { getPublicClient, getWalletClient, getContract } from "./provider";
import { getTokenAddress } from "./addresses";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";

import { getValidDeposits } from "./events";

import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

export const updateWalletStatus = async (): Promise<void> => {
  const user = useUser();

  const publicClient = getPublicClient();
  const walletClient = getWalletClient();

  if (!publicClient || !walletClient) {
    console.error("Client not initialized");
    return;
  }

  // Get balance
  const [account] = await walletClient.getAddresses();
  const balance = await publicClient.getBalance({ address: account });

  user.setWalletAddress(account);
  user.setBalance(formatEther(balance));
};

export const listValidDepositTransactionsByWalletAddress = async (
  walletAddress: string
): Promise<ValidDeposit[]> => {
  const user = useUser();
  const walletDeposits = await getValidDeposits(
    getTokenAddress(user.selectedToken.value),
    user.networkName.value
  );
  if (walletDeposits) {
    return walletDeposits
      .filter((deposit) => deposit.seller == walletAddress)
      .sort((a: ValidDeposit, b: ValidDeposit) => {
        return b.blockNumber - a.blockNumber;
      });
  }

  return [];
};

const getLockStatus = async (id: bigint): Promise<number> => {
  const { address, abi, client } = await getContract();
  const result = await client.readContract({
    address,
    abi,
    functionName: "getLocksStatus",
    args: [[id]],
  });
  return result[1][0];
};

const filterLockStatus = async (
  transactions: Log[]
): Promise<WalletTransaction[]> => {
  const txs: WalletTransaction[] = [];

  for (const transaction of transactions) {
    try {
      const decoded = decodeEventLog({
        abi: p2pix.abi,
        data: transaction.data,
        topics: transaction.topics,
      });

      if (!decoded || !decoded.args) continue;

      // Type assertion to handle the args safely
      const args = decoded.args as Record<string, any>;

      const tx: WalletTransaction = {
        token: args.token ? String(args.token) : "",
        blockNumber: Number(transaction.blockNumber),
        amount: args.amount ? Number(formatEther(args.amount)) : -1,
        seller: args.seller ? String(args.seller) : "",
        buyer: args.buyer ? String(args.buyer) : "",
        event: decoded.eventName || "",
        lockStatus:
          decoded.eventName == "LockAdded" && args.lockID
            ? await getLockStatus(args.lockID)
            : -1,
        transactionHash: transaction.transactionHash
          ? transaction.transactionHash
          : "",
        transactionID: args.lockID ? args.lockID.toString() : "",
      };
      txs.push(tx);
    } catch (error) {
      console.error("Error decoding log", error);
    }
  }
  return txs;
};

export const listAllTransactionByWalletAddress = async (
  walletAddress: string
): Promise<WalletTransaction[]> => {
  const { address, client } = await getContract(true);

  // Get deposits
  const depositLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event DepositAdded(address indexed seller, address token, uint256 amount)",
    ])[0],
    args: {
      seller: walletAddress,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });
  console.log("Fetched all wallet deposits");

  // Get locks
  const lockLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event LockAdded(address indexed buyer, uint256 indexed lockID, address seller, address token, uint256 amount)",
    ])[0],
    args: {
      buyer: walletAddress,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });
  console.log("Fetched all wallet locks");

  // Get released locks
  const releasedLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event LockReleased(address indexed buyer, uint256 indexed lockID, string e2eId)",
    ])[0],
    args: {
      buyer: walletAddress,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });
  console.log("Fetched all wallet released locks");

  // Get withdrawn deposits
  const withdrawnLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event DepositWithdrawn(address indexed seller, address token, uint256 amount)",
    ])[0],
    args: {
      seller: walletAddress,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });
  console.log("Fetched all wallet withdrawn deposits");

  const allLogs = [
    ...depositLogs,
    ...lockLogs,
    ...releasedLogs,
    ...withdrawnLogs,
  ].sort((a: Log, b: Log) => {
    return Number(b.blockNumber) - Number(a.blockNumber);
  });

  return await filterLockStatus(allLogs);
};

// get wallet's release transactions
export const listReleaseTransactionByWalletAddress = async (
  walletAddress: string
) => {
  const { address, client } = await getContract(true);

  const releasedLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event LockReleased(address indexed buyer, uint256 indexed lockID, string e2eId)",
    ])[0],
    args: {
      buyer: walletAddress,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });

  return releasedLogs
    .sort((a: Log, b: Log) => {
      return Number(b.blockNumber) - Number(a.blockNumber);
    })
    .map((log: Log) => {
      try {
        return decodeEventLog({
          abi: p2pix.abi,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        console.error("Error decoding log", error);
        return null;
      }
    })
    .filter((decoded: any) => decoded !== null);
};

const listLockTransactionByWalletAddress = async (walletAddress: string) => {
  const { address, client } = await getContract(true);

  const lockLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event LockAdded(address indexed buyer, uint256 indexed lockID, address seller, address token, uint256 amount)",
    ])[0],
    args: {
      buyer: walletAddress,
    },
    fromBlock: 0n,
    toBlock: "latest",
  });

  return lockLogs
    .sort((a: Log, b: Log) => {
      return Number(b.blockNumber) - Number(a.blockNumber);
    })
    .map((log: Log) => {
      try {
        return decodeEventLog({
          abi: p2pix.abi,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        console.error("Error decoding log", error);
        return null;
      }
    })
    .filter((decoded: any) => decoded !== null);
};

const listLockTransactionBySellerAddress = async (sellerAddress: string) => {
  const { address, client } = await getContract(true);
  console.log("Will get locks as seller", sellerAddress);

  const lockLogs = await client.getLogs({
    address,
    event: parseAbi([
      "event LockAdded(address indexed buyer, uint256 indexed lockID, address seller, address token, uint256 amount)",
    ])[0],
    fromBlock: 0n,
    toBlock: "latest",
  });

  return lockLogs
    .map((log: Log) => {
      try {
        return decodeEventLog({
          abi: p2pix.abi,
          data: log.data,
          topics: log.topics,
        });
      } catch (error) {
        console.error("Error decoding log", error);
        return null;
      }
    })
    .filter((decoded: any) => decoded !== null)
    .filter(
      (decoded: any) =>
        decoded.args &&
        decoded.args.seller &&
        decoded.args.seller.toLowerCase() === sellerAddress.toLowerCase()
    );
};

export const checkUnreleasedLock = async (
  walletAddress: string
): Promise<UnreleasedLock | undefined> => {
  const { address, abi, client } = await getContract();
  const pixData: Pix = {
    pixKey: "",
  };

  const addedLocks = await listLockTransactionByWalletAddress(walletAddress);

  if (!addedLocks.length) return undefined;

  const lockIds = addedLocks.map((lock: any) => lock.args.lockID);

  const lockStatus = await client.readContract({
    address,
    abi,
    functionName: "getLocksStatus",
    args: [lockIds],
  });

  const unreleasedLockId = lockStatus[1].findIndex(
    (status: number) => status == 1
  );

  if (unreleasedLockId !== -1) {
    const lockID = lockStatus[0][unreleasedLockId];

    const lock = await client.readContract({
      address,
      abi,
      functionName: "mapLocks",
      args: [lockID],
    });

    const pixTarget = lock.pixTarget;
    const amount = formatEther(lock.amount);
    pixData.pixKey = pixTarget;
    pixData.value = Number(amount);

    return {
      lockID,
      pix: pixData,
    };
  }
};

export const getActiveLockAmount = async (
  walletAddress: string
): Promise<number> => {
  const { address, abi, client } = await getContract(true);
  const lockSeller = await listLockTransactionBySellerAddress(walletAddress);

  if (!lockSeller.length) return 0;

  const lockIds = lockSeller.map((lock: any) => lock.args.lockID);

  const lockStatus = await client.readContract({
    address,
    abi,
    functionName: "getLocksStatus",
    args: [lockIds],
  });

  let activeLockAmount = 0;
  for (let i = 0; i < lockStatus[1].length; i++) {
    if (lockStatus[1][i] === 1) {
      const lockId = lockStatus[0][i];
      const lock = await client.readContract({
        address,
        abi,
        functionName: "mapLocks",
        args: [lockId],
      });
      activeLockAmount += Number(formatEther(lock.amount));
    }
  }

  return activeLockAmount;
};

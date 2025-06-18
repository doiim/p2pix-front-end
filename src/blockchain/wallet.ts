import { decodeEventLog, formatEther, type Log } from "viem";
import { useUser } from "@/composables/useUser";

import { getPublicClient, getWalletClient, getContract } from "./provider";
import { getTokenAddress } from "./addresses";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";

import { getValidDeposits } from "./events";

import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";
import { getNetworkSubgraphURL } from "@/model/NetworkEnum";

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
  const user = useUser();

  // Get the current network for the subgraph URL
  const network = user.networkName.value;

  // Query subgraph for all relevant transactions
  const subgraphQuery = {
    query: `
      {
        depositAddeds(where: {seller: "${walletAddress.toLowerCase()}"}) {
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
        lockAddeds(where: {buyer: "${walletAddress.toLowerCase()}"}) {
          buyer
          lockID
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
        lockReleaseds(where: {buyer: "${walletAddress.toLowerCase()}"}) {
          buyer
          lockId
          e2eId
          blockTimestamp
          blockNumber
          transactionHash
        }
        depositWithdrawns(where: {seller: "${walletAddress.toLowerCase()}"}) {
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
      }
    `,
  };

  console.log("Fetching transactions from subgraph");
  const response = await fetch(getNetworkSubgraphURL(network), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subgraphQuery),
  });

  const data = await response.json();
  console.log("Subgraph data fetched:", data);

  // Convert all transactions to common WalletTransaction format
  const transactions: WalletTransaction[] = [];

  // Process deposit added events
  if (data.data?.depositAddeds) {
    console.log("Processing deposit events");
    for (const deposit of data.data.depositAddeds) {
      transactions.push({
        token: deposit.token,
        blockNumber: parseInt(deposit.blockNumber),
        amount: parseFloat(formatEther(BigInt(deposit.amount))),
        seller: deposit.seller,
        buyer: "",
        event: "DepositAdded",
        lockStatus: -1,
        transactionHash: deposit.transactionHash,
      });
    }
  }

  // Process lock added events
  if (data.data?.lockAddeds) {
    console.log("Processing lock events");
    for (const lock of data.data.lockAddeds) {
      // Get lock status from the contract
      const lockStatus = await getLockStatus(BigInt(lock.lockID));

      transactions.push({
        token: lock.token,
        blockNumber: parseInt(lock.blockNumber),
        amount: parseFloat(formatEther(BigInt(lock.amount))),
        seller: lock.seller,
        buyer: lock.buyer,
        event: "LockAdded",
        lockStatus: lockStatus,
        transactionHash: lock.transactionHash,
        transactionID: lock.lockID.toString(),
      });
    }
  }

  // Process lock released events
  if (data.data?.lockReleaseds) {
    console.log("Processing release events");
    for (const release of data.data.lockReleaseds) {
      transactions.push({
        token: "", // Subgraph doesn't provide token in this event, we could enhance this later
        blockNumber: parseInt(release.blockNumber),
        amount: -1, // Amount not available in this event
        seller: "",
        buyer: release.buyer,
        event: "LockReleased",
        lockStatus: -1,
        transactionHash: release.transactionHash,
        transactionID: release.lockId.toString(),
      });
    }
  }

  // Process deposit withdrawn events
  if (data.data?.depositWithdrawns) {
    console.log("Processing withdrawal events");
    for (const withdrawal of data.data.depositWithdrawns) {
      transactions.push({
        token: withdrawal.token,
        blockNumber: parseInt(withdrawal.blockNumber),
        amount: parseFloat(formatEther(BigInt(withdrawal.amount))),
        seller: withdrawal.seller,
        buyer: "",
        event: "DepositWithdrawn",
        lockStatus: -1,
        transactionHash: withdrawal.transactionHash,
      });
    }
  }

  // Sort transactions by block number (newest first)
  return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
};

// get wallet's release transactions
export const listReleaseTransactionByWalletAddress = async (
  walletAddress: string
) => {
  const user = useUser();
  const network = user.networkName.value;

  // Query subgraph for release transactions
  const subgraphQuery = {
    query: `
      {
        lockReleaseds(where: {buyer: "${walletAddress.toLowerCase()}"}) {
          buyer
          lockId
          e2eId
          blockTimestamp
          blockNumber
          transactionHash
        }
      }
    `,
  };

  // Fetch data from subgraph
  const response = await fetch(getNetworkSubgraphURL(network), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subgraphQuery),
  });

  const data = await response.json();

  // Process the subgraph response into the same format as the previous implementation
  if (!data.data?.lockReleaseds) {
    return [];
  }

  // Transform the subgraph data to match the event log decode format
  return data.data.lockReleaseds
    .sort((a: any, b: any) => {
      return parseInt(b.blockNumber) - parseInt(a.blockNumber);
    })
    .map((release: any) => {
      try {
        // Create a structure similar to the decoded event log
        return {
          eventName: "LockReleased",
          args: {
            buyer: release.buyer,
            lockID: BigInt(release.lockId),
            e2eId: release.e2eId,
          },
          // Add any other necessary fields to match the original return format
          blockNumber: BigInt(release.blockNumber),
          transactionHash: release.transactionHash,
        };
      } catch (error) {
        console.error("Error processing subgraph data", error);
        return null;
      }
    })
    .filter((decoded: any) => decoded !== null);
};

const listLockTransactionByWalletAddress = async (walletAddress: string) => {
  const user = useUser();
  const network = user.networkName.value;

  // Query subgraph for lock added transactions
  const subgraphQuery = {
    query: `
      {
        lockAddeds(where: {buyer: "${walletAddress.toLowerCase()}"}) {
          buyer
          lockID
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
      }
    `,
  };

  try {
    // Fetch data from subgraph
    const response = await fetch(getNetworkSubgraphURL(network), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subgraphQuery),
    });

    const data = await response.json();

    if (!data.data?.lockAddeds) {
      return [];
    }

    // Transform the subgraph data to match the event log decode format
    return data.data.lockAddeds
      .sort((a: any, b: any) => {
        return parseInt(b.blockNumber) - parseInt(a.blockNumber);
      })
      .map((lock: any) => {
        try {
          // Create a structure similar to the decoded event log
          return {
            eventName: "LockAdded",
            args: {
              buyer: lock.buyer,
              lockID: BigInt(lock.lockID),
              seller: lock.seller,
              token: lock.token,
              amount: BigInt(lock.amount),
            },
            // Add other necessary fields to match the original format
            blockNumber: BigInt(lock.blockNumber),
            transactionHash: lock.transactionHash,
          };
        } catch (error) {
          console.error("Error processing subgraph data", error);
          return null;
        }
      })
      .filter((decoded: any) => decoded !== null);
  } catch (error) {
    console.error("Error fetching from subgraph:", error);
  }
};

const listLockTransactionBySellerAddress = async (sellerAddress: string) => {
  const user = useUser();
  const network = user.networkName.value;
  console.log("Will get locks as seller", sellerAddress);

  // Query subgraph for lock added transactions where seller matches
  const subgraphQuery = {
    query: `
      {
        lockAddeds(where: {seller: "${sellerAddress.toLowerCase()}"}) {
          buyer
          lockID
          seller
          token
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
      }
    `,
  };

  try {
    // Fetch data from subgraph
    const response = await fetch(getNetworkSubgraphURL(network), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(subgraphQuery),
    });

    const data = await response.json();

    if (!data.data?.lockAddeds) {
      return [];
    }

    // Transform the subgraph data to match the event log decode format
    return data.data.lockAddeds
      .sort((a: any, b: any) => {
        return parseInt(b.blockNumber) - parseInt(a.blockNumber);
      })
      .map((lock: any) => {
        try {
          // Create a structure similar to the decoded event log
          return {
            eventName: "LockAdded",
            args: {
              buyer: lock.buyer,
              lockID: BigInt(lock.lockID),
              seller: lock.seller,
              token: lock.token,
              amount: BigInt(lock.amount),
            },
            // Add other necessary fields to match the original format
            blockNumber: BigInt(lock.blockNumber),
            transactionHash: lock.transactionHash,
          };
        } catch (error) {
          console.error("Error processing subgraph data", error);
          return null;
        }
      })
      .filter((decoded: any) => decoded !== null);
  } catch (error) {
    console.error("Error fetching from subgraph:", error);
    return [];
  }
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

  const mapLocksRequests = lockStatus[0].map((id: bigint) =>
    client.readContract({
      address,
      abi,
      functionName: "mapLocks",
      args: [id],
    })
  );

  const mapLocksResults = await client.multicall({
    contracts: mapLocksRequests as any,
  });

  return mapLocksResults.reduce((total: number, lock: any, index: number) => {
    if (lockStatus[1][index] === 1) {
      return total + Number(formatEther(lock.amount));
    }
    return total;
  }, 0);
};

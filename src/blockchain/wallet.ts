import { formatEther, type Address } from "viem";
import { useUser } from "@/composables/useUser";

import { getPublicClient, getWalletClient, getContract } from "./provider";

import { getValidDeposits, getUnreleasedLockById } from "./events";

import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import { LockStatus } from "@/model/LockStatus";

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
  walletAddress: Address
): Promise<ValidDeposit[]> => {
  const user = useUser();
  const walletDeposits = await getValidDeposits(
    user.network.value.tokens[user.selectedToken.value].address,
    user.network.value
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

const getLockStatus = async (id: bigint): Promise<LockStatus> => {
  const { address, abi, client } = await getContract();
  const [ sortedIDs , status ] = await client.readContract({
    address,
    abi,
    functionName: "getLocksStatus",
    args: [[id]],
  });
  return status[0];
};

export const listAllTransactionByWalletAddress = async (
  walletAddress: Address
): Promise<WalletTransaction[]> => {
  const user = useUser();

  // Get the current network for the subgraph URL
  const network = user.network.value;

  // Query subgraph for all relevant transactions
  const subgraphQuery = {
    query: `
      {
        depositAddeds(where: {seller: "${walletAddress.toLowerCase()}"}) {
          id
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
          amount
          blockTimestamp
          blockNumber
          transactionHash
        }
        lockReleaseds(where: {buyer: "${walletAddress.toLowerCase()}"}) {
          buyer
          lockId
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

  const response = await fetch(network.subgraphUrls[0], {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(subgraphQuery),
  });

  const data = await response.json();
  // Convert all transactions to common WalletTransaction format
  const transactions: WalletTransaction[] = [];

  // Process deposit added events
  if (data.data?.depositAddeds) {
    for (const deposit of data.data.depositAddeds) {
      transactions.push({
        token: deposit.token,
        blockNumber: parseInt(deposit.blockNumber),
        blockTimestamp: parseInt(deposit.blockTimestamp),
        amount: parseFloat(formatEther(BigInt(deposit.amount))),
        seller: deposit.seller,
        buyer: "",
        event: "DepositAdded",
        lockStatus: undefined,
        transactionHash: deposit.transactionHash,
      });
    }
  }

  // Process lock added events
  if (data.data?.lockAddeds) {
    for (const lock of data.data.lockAddeds) {
      // Get lock status from the contract
      const lockStatus = await getLockStatus(BigInt(lock.lockID));

      transactions.push({
        token: lock.token,
        blockNumber: parseInt(lock.blockNumber),
        blockTimestamp: parseInt(lock.blockTimestamp),
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
    for (const release of data.data.lockReleaseds) {
      transactions.push({
        token: undefined, // Subgraph doesn't provide token in this event, we could enhance this later
        blockNumber: parseInt(release.blockNumber),
        blockTimestamp: parseInt(release.blockTimestamp),
        amount: -1, // Amount not available in this event
        seller: "",
        buyer: release.buyer,
        event: "LockReleased",
        lockStatus: undefined,
        transactionHash: release.transactionHash,
        transactionID: release.lockId.toString(),
      });
    }
  }

  // Process deposit withdrawn events
  if (data.data?.depositWithdrawns) {
    for (const withdrawal of data.data.depositWithdrawns) {
      transactions.push({
        token: withdrawal.token,
        blockNumber: parseInt(withdrawal.blockNumber),
        blockTimestamp: parseInt(withdrawal.blockTimestamp),
        amount: parseFloat(formatEther(BigInt(withdrawal.amount))),
        seller: withdrawal.seller,
        buyer: "",
        event: "DepositWithdrawn",
        lockStatus: undefined,
        transactionHash: withdrawal.transactionHash,
      });
    }
  }

  // Sort transactions by block number (newest first)
  return transactions.sort((a, b) => b.blockNumber - a.blockNumber);
};

// get wallet's release transactions
export const listReleaseTransactionByWalletAddress = async (
  walletAddress: Address
) => {
  const user = useUser();
  const network = user.network.value;

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
  const response = await fetch(network.subgraphUrls[0], {
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

const listLockTransactionByWalletAddress = async (walletAddress: Address) => {
  const user = useUser();
  const network = user.network.value;

  // Query subgraph for lock added transactions
  const subgraphQuery = {
    query: `
      {
        lockAddeds(where: {buyer: "${walletAddress.toLowerCase()}"}) {
          buyer
          lockID
          seller
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
    const response = await fetch(network.subgraphUrls[0], {
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
              token: undefined, // Token not available in LockAdded subgraph event
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

const listLockTransactionBySellerAddress = async (sellerAddress: Address) => {
  const user = useUser();
  const network = user.network.value;

  // Query subgraph for lock added transactions where seller matches
  const subgraphQuery = {
    query: `
      {
        lockAddeds(where: {seller: "${sellerAddress.toLowerCase()}"}) {
          buyer
          lockID
          seller
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
    const response = await fetch(network.subgraphUrls[0], {
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
              token: undefined, // Token not available in LockAdded subgraph event
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
  walletAddress: Address
): Promise<UnreleasedLock | undefined> => {
  const { address, abi, client } = await getContract();
  const addedLocks = await listLockTransactionByWalletAddress(walletAddress);

  if (!addedLocks.length) return undefined;

  const lockIds = addedLocks.map((lock: any) => lock.args.lockID);

  const [ sortedIDs, status ] = await client.readContract({
    address,
    abi,
    functionName: "getLocksStatus",
    args: [lockIds],
  });

  const unreleasedLockId = status.findIndex(
    (status: LockStatus) => status == LockStatus.Active
  );
  
  if (unreleasedLockId !== -1)
    return getUnreleasedLockById(sortedIDs[unreleasedLockId]);
};

export const getActiveLockAmount = async (
  walletAddress: Address
): Promise<number> => {
  const { address, abi, client } = await getContract(true);
  const lockSeller = await listLockTransactionBySellerAddress(walletAddress);

  if (!lockSeller.length) return 0;

  const lockIds = lockSeller.map((lock: any) => lock.args.lockID);

  const [ sortedIDs, status ] = await client.readContract({
    address,
    abi,
    functionName: "getLocksStatus",
    args: [lockIds],
  });

  const mapLocksRequests = status.map((id: LockStatus) =>
    client.readContract({
      address: address,
      abi,
      functionName: "mapLocks",
      args: [BigInt(id)],
    })
  );

  const mapLocksResults = await client.multicall({
    contracts: mapLocksRequests as any,
  });

  return mapLocksResults.reduce((total: number, lock: any, index: number) => {
    if (status[index] === 1) {
      return total + Number(formatEther(lock.amount));
    }
    return total;
  }, 0);
};

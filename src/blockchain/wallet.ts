import {
  Contract,
  formatEther,
  getAddress,
  Interface,
  Log,
  LogDescription,
} from "ethers";
import { useEtherStore } from "@/store/ether";

import { getContract, getProvider } from "./provider";
import { getTokenAddress, isPossibleNetwork } from "./addresses";

import mockToken from "@/utils/smart_contract_files/MockToken.json";
import p2pix from "@/utils/smart_contract_files/P2PIX.json";

import { getValidDeposits } from "./events";

import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

export const updateWalletStatus = async (): Promise<void> => {
  const etherStore = useEtherStore();

  const provider = await getProvider();
  const signer = await provider.getSigner();

  const { chainId } = await provider.getNetwork();
  if (!isPossibleNetwork(Number(chainId))) {
    window.alert("Invalid chain!:" + chainId);
    return;
  }
  etherStore.setNetworkId(Number(chainId));

  const mockTokenContract = new Contract(
    getTokenAddress(etherStore.selectedToken),
    mockToken.abi,
    signer
  );

  const walletAddress = await provider.send("eth_requestAccounts", []);
  const balance = await mockTokenContract.balanceOf(walletAddress[0]);

  etherStore.setBalance(formatEther(balance));
  etherStore.setWalletAddress(getAddress(walletAddress[0]));
};

export const listValidDepositTransactionsByWalletAddress = async (
  walletAddress: string
): Promise<ValidDeposit[]> => {
  const etherStore = useEtherStore();
  const walletDeposits = await getValidDeposits(
    getTokenAddress(etherStore.selectedToken)
  );

  if (walletDeposits) {
    return walletDeposits
      .filter((deposit) => deposit.seller == walletAddress)
      .sort((a, b) => {
        return b.blockNumber - a.blockNumber;
      });
  }

  return [];
};

const getLockStatus = async (id: [BigInt]): Promise<number> => {
  const p2pContract = await getContract();
  const res = await p2pContract.getLocksStatus([id]);

  return res[1][0];
};

const filterLockStatus = async (
  transactions: Log[]
): Promise<WalletTransaction[]> => {
  const txs: WalletTransaction[] = [];

  for (const transaction of transactions) {
    const IPix2Pix = new Interface(p2pix.abi);
    const decoded = IPix2Pix.parseLog({
      topics: transaction.topics,
      data: transaction.data,
    });
    if (!decoded) continue;
    const tx: WalletTransaction = {
      token: decoded.args.token ? decoded.args.token : "",
      blockNumber: transaction.blockNumber,
      amount: decoded.args.amount
        ? Number(formatEther(decoded.args.amount))
        : -1,
      seller: decoded.args.seller ? decoded.args.seller : "",
      buyer: decoded.args.buyer ? decoded.args.buyer : "",
      event: decoded.name,
      lockStatus:
        decoded.name == "LockAdded"
          ? await getLockStatus(decoded.args.lockID)
          : -1,
      transactionHash: transaction.transactionHash
        ? transaction.transactionHash
        : "",
      transactionID: decoded.args.lockID ? decoded.args.lockID.toString() : "",
    };
    txs.push(tx);
  }
  return txs;
};

export const listAllTransactionByWalletAddress = async (
  walletAddress: string
): Promise<WalletTransaction[]> => {
  const p2pContract = await getContract(true);

  const filterDeposits = p2pContract.filters.DepositAdded([walletAddress]);
  const eventsDeposits = await p2pContract.queryFilter(
    filterDeposits,
    0,
    "latest"
  );

  const filterAddedLocks = p2pContract.filters.LockAdded([walletAddress]);
  const eventsAddedLocks = await p2pContract.queryFilter(
    filterAddedLocks,
    0,
    "latest"
  );

  const filterReleasedLocks = p2pContract.filters.LockReleased([walletAddress]);
  const eventsReleasedLocks = await p2pContract.queryFilter(
    filterReleasedLocks,
    0,
    "latest"
  );

  const filterWithdrawnDeposits = p2pContract.filters.DepositWithdrawn([
    walletAddress,
  ]);
  const eventsWithdrawnDeposits = await p2pContract.queryFilter(
    filterWithdrawnDeposits
  );

  const lockStatusFiltered = await filterLockStatus(
    [
      ...eventsDeposits,
      ...eventsAddedLocks,
      ...eventsReleasedLocks,
      ...eventsWithdrawnDeposits,
    ].sort((a, b) => {
      return b.blockNumber - a.blockNumber;
    })
  );

  return lockStatusFiltered;
};

// get wallet's release transactions
export const listReleaseTransactionByWalletAddress = async (
  walletAddress: string
): Promise<LogDescription[]> => {
  const p2pContract = await getContract(true);

  const filterReleasedLocks = p2pContract.filters.LockReleased([walletAddress]);
  const eventsReleasedLocks = await p2pContract.queryFilter(
    filterReleasedLocks,
    0,
    "latest"
  );

  return eventsReleasedLocks
    .sort((a, b) => {
      return b.blockNumber - a.blockNumber;
    })
    .map((lock) => {
      const IPix2Pix = new Interface(p2pix.abi);
      const decoded = IPix2Pix.parseLog({
        topics: lock.topics,
        data: lock.data,
      });
      return decoded;
    })
    .filter((lock) => lock !== null);
};

const listLockTransactionByWalletAddress = async (
  walletAddress: string
): Promise<LogDescription[]> => {
  const p2pContract = await getContract(true);

  const filterAddedLocks = p2pContract.filters.LockAdded([walletAddress]);
  const eventsReleasedLocks = await p2pContract.queryFilter(filterAddedLocks);

  return eventsReleasedLocks
    .sort((a, b) => {
      return b.blockNumber - a.blockNumber;
    })
    .map((lock) => {
      const IPix2Pix = new Interface(p2pix.abi);
      const decoded = IPix2Pix.parseLog({
        topics: lock.topics,
        data: lock.data,
      });
      return decoded;
    })
    .filter((lock) => lock !== null);
};

const listLockTransactionBySellerAddress = async (
  sellerAddress: string
): Promise<LogDescription[]> => {
  const p2pContract = await getContract(true);

  const filterAddedLocks = p2pContract.filters.LockAdded();
  const eventsReleasedLocks = await p2pContract.queryFilter(filterAddedLocks);

  return eventsReleasedLocks
    .map((lock) => {
      const IPix2Pix = new Interface(p2pix.abi);
      const decoded = IPix2Pix.parseLog({
        topics: lock.topics,
        data: lock.data,
      });
      return decoded;
    })
    .filter((lock) => lock !== null)
    .filter(
      (lock) => lock.args.seller.toLowerCase() == sellerAddress.toLowerCase()
    );
};

export const checkUnreleasedLock = async (
  walletAddress: string
): Promise<UnreleasedLock | undefined> => {
  const p2pContract = await getContract();
  const pixData: Pix = {
    pixKey: "",
  };

  const addedLocks = await listLockTransactionByWalletAddress(walletAddress);
  const lockStatus = await p2pContract.getLocksStatus(
    addedLocks.map((lock) => lock.args?.lockID)
  );
  const unreleasedLockId = lockStatus[1].findIndex(
    (lockStatus: number) => lockStatus == 1
  );

  if (unreleasedLockId != -1) {
    const _lockID = lockStatus[0][unreleasedLockId];
    const lock = await p2pContract.mapLocks(_lockID);

    const pixTarget = lock.pixTarget;
    const amount = formatEther(lock?.amount);
    pixData.pixKey = pixTarget;
    pixData.value = Number(amount);

    return {
      lockID: _lockID,
      pix: pixData,
    };
  }
};

export const getActiveLockAmount = async (
  walletAddress: string
): Promise<number> => {
  const p2pContract = await getContract();
  const lockSeller = await listLockTransactionBySellerAddress(walletAddress);

  const lockStatus = await p2pContract.getLocksStatus(
    lockSeller.map((lock) => lock.args?.lockID)
  );

  const activeLockAmount = await lockStatus[1].reduce(
    async (sumValue: Promise<number>, currentStatus: number, index: number) => {
      const currValue = await sumValue;
      let valueToSum = 0;

      if (currentStatus == 1) {
        const lock = await p2pContract.mapLocks(lockStatus[0][index]);
        valueToSum = Number(formatEther(lock?.amount));
      }

      return currValue + valueToSum;
    },
    Promise.resolve(0)
  );

  return activeLockAmount;
};

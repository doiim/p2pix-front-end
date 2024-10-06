import { useEtherStore } from "@/store/ether";

import { getContract, getProvider } from "./provider";
import { getTokenAddress, possibleChains, isPossibleNetwork } from "./addresses";

import mockToken from "@/utils/smart_contract_files/MockToken.json";

import { ethers, type Event, type BigNumber } from "ethers";
import { formatEther } from "ethers/lib/utils";
import { getValidDeposits } from "./events";

import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

const updateWalletStatus = async (): Promise<void> => {
  const etherStore = useEtherStore();

  const provider = getProvider();
  const signer = provider.getSigner();

  const { chainId } = await provider.getNetwork();
  if (!isPossibleNetwork(chainId.toString())) {
    window.alert("Invalid chain!:" + chainId);
    return;
  }
  etherStore.setNetworkName(possibleChains[chainId]);

  const mockTokenContract = new ethers.Contract(
    getTokenAddress(etherStore.selectedToken),
    mockToken.abi,
    signer
  );

  const walletAddress = await provider.send("eth_requestAccounts", []);
  const balance = await mockTokenContract.balanceOf(walletAddress[0]);

  etherStore.setBalance(formatEther(balance));
  etherStore.setWalletAddress(ethers.utils.getAddress(walletAddress[0]));
};

const listValidDepositTransactionsByWalletAddress = async (
  walletAddress: string
): Promise<ValidDeposit[]> => {
  const etherStore = useEtherStore();
  const walletDeposits = await getValidDeposits(getTokenAddress(etherStore.selectedToken));

  if (walletDeposits) {
    return walletDeposits
      .filter((deposit) => deposit.seller == walletAddress)
      .sort((a, b) => {
        return b.blockNumber - a.blockNumber;
      });
  }

  return [];
};

const getLockStatus = async (id: [BigNumber]): Promise<number> => {
  const p2pContract = getContract();
  const res = await p2pContract.getLocksStatus([id]);

  return res[1][0];
};

const filterLockStatus = async (
  transactions: Event[]
): Promise<WalletTransaction[]> => {
  const txs = await Promise.all(
    transactions.map(async (transaction) => {
      const tx: WalletTransaction = {
        token: transaction.args?.token ? transaction.args?.token : "",
        blockNumber: transaction.blockNumber ? transaction.blockNumber : -1,
        amount: transaction.args?.amount
          ? Number(formatEther(transaction.args?.amount))
          : -1,
        seller: transaction.args?.seller ? transaction.args?.seller : "",
        buyer: transaction.args?.buyer ? transaction.args?.buyer : "",
        event: transaction.event ? transaction.event : "",
        lockStatus:
          transaction.event == "LockAdded"
            ? await getLockStatus(transaction.args?.lockID)
            : -1,
        transactionHash: transaction.transactionHash
          ? transaction.transactionHash
          : "",
        transactionID: transaction.args?.lockID
          ? String(transaction.args?.lockID)
          : "",
      };

      return tx;
    })
  );

  return txs;
};

const listAllTransactionByWalletAddress = async (
  walletAddress: string
): Promise<WalletTransaction[]> => {
  const p2pContract = getContract(true);

  const filterDeposits = p2pContract.filters.DepositAdded([walletAddress]);
  const eventsDeposits = await p2pContract.queryFilter(filterDeposits);

  const filterAddedLocks = p2pContract.filters.LockAdded([walletAddress]);
  const eventsAddedLocks = await p2pContract.queryFilter(filterAddedLocks);

  const filterReleasedLocks = p2pContract.filters.LockReleased([walletAddress]);
  const eventsReleasedLocks = await p2pContract.queryFilter(
    filterReleasedLocks
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
const listReleaseTransactionByWalletAddress = async (
  walletAddress: string
): Promise<Event[]> => {
  const p2pContract = getContract(true);

  const filterReleasedLocks = p2pContract.filters.LockReleased([walletAddress]);
  const eventsReleasedLocks = await p2pContract.queryFilter(
    filterReleasedLocks
  );

  return eventsReleasedLocks.sort((a, b) => {
    return b.blockNumber - a.blockNumber;
  });
};

const listLockTransactionByWalletAddress = async (
  walletAddress: string
): Promise<Event[]> => {
  const p2pContract = getContract(true);

  const filterAddedLocks = p2pContract.filters.LockAdded([walletAddress]);
  const eventsReleasedLocks = await p2pContract.queryFilter(filterAddedLocks);

  return eventsReleasedLocks.sort((a, b) => {
    return b.blockNumber - a.blockNumber;
  });
};

const listLockTransactionBySellerAddress = async (
  sellerAddress: string
): Promise<Event[]> => {
  const p2pContract = getContract(true);

  const filterAddedLocks = p2pContract.filters.LockAdded();
  const eventsReleasedLocks = await p2pContract.queryFilter(filterAddedLocks);

  return eventsReleasedLocks.filter((lock) =>
    lock.args?.seller
      .toHexString()
      .substring(3)
      .includes(sellerAddress.substring(2).toLowerCase())
  );
};

const checkUnreleasedLock = async (
  walletAddress: string
): Promise<UnreleasedLock | undefined> => {
  const p2pContract = getContract();
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

const getActiveLockAmount = async (walletAddress: string): Promise<number> => {
  const p2pContract = getContract();
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

export {
  updateWalletStatus,
  listValidDepositTransactionsByWalletAddress,
  listAllTransactionByWalletAddress,
  listReleaseTransactionByWalletAddress,
  checkUnreleasedLock,
  getActiveLockAmount,
};

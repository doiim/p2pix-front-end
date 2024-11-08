import { useEtherStore } from "@/store/ether";
import { Contract, formatEther, Interface } from "ethers";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { getContract } from "./provider";
import type { ValidDeposit } from "@/model/ValidDeposit";
import {
  getP2PixAddress,
  getProviderByNetwork,
  getTokenAddress,
} from "./addresses";
import { NetworkEnum } from "@/model/NetworkEnum";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

const getNetworksLiquidity = async (): Promise<void> => {
  const etherStore = useEtherStore();
  etherStore.setLoadingNetworkLiquidity(true);

  const depositLists: ValidDeposit[][] = [];

  for (const network of Object.values(NetworkEnum).filter(
    (v) => !isNaN(Number(v))
  )) {
    console.log("getNetworksLiquidity", network);
    const p2pContract = new Contract(
      getP2PixAddress(network as NetworkEnum),
      p2pix.abi,
      getProviderByNetwork(network as NetworkEnum)
    );

    depositLists.push(
      await getValidDeposits(
        getTokenAddress(etherStore.selectedToken, network as NetworkEnum),
        network as NetworkEnum,
        p2pContract
      )
    );
  }

  etherStore.setDepositsValidList(depositLists.flat());
  etherStore.setLoadingNetworkLiquidity(false);
};

const getPixKey = async (seller: string, token: string): Promise<string> => {
  const p2pContract = await getContract();
  const pixKeyHex = await p2pContract.getPixTarget(seller, token);
  // Remove '0x' prefix and convert hex to UTF-8 string
  const bytes = new Uint8Array(
    pixKeyHex
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
  contract?: Contract
): Promise<ValidDeposit[]> => {
  let p2pContract: Contract;

  if (contract) {
    p2pContract = contract;
  } else {
    p2pContract = await getContract(true);
  }

  const filterDeposits = p2pContract.filters.DepositAdded(null);
  const eventsDeposits = await p2pContract.queryFilter(
    filterDeposits
    // 0,
    // "latest"
  );
  if (!contract) p2pContract = await getContract(); // get metamask provider contract
  const depositList: { [key: string]: ValidDeposit } = {};

  for (const deposit of eventsDeposits) {
    const IPix2Pix = new Interface(p2pix.abi);
    const decoded = IPix2Pix.parseLog({
      topics: deposit.topics,
      data: deposit.data,
    });
    // Get liquidity only for the selected token
    if (decoded?.args.token != token) continue;
    const mappedBalance = await p2pContract.getBalance(
      decoded.args.seller,
      token
    );
    let validDeposit: ValidDeposit | null = null;

    if (mappedBalance) {
      validDeposit = {
        token: token,
        blockNumber: deposit.blockNumber,
        remaining: Number(formatEther(mappedBalance)),
        seller: decoded.args.seller,
        network,
        pixKey: "",
      };
    }
    if (validDeposit) depositList[decoded.args.seller + token] = validDeposit;
  }

  return Object.values(depositList);
};

const getUnreleasedLockById = async (
  lockID: string
): Promise<UnreleasedLock> => {
  const p2pContract = await getContract();
  const pixData: Pix = {
    pixKey: "",
  };

  const lock = await p2pContract.mapLocks(lockID);

  const pixTarget = lock.pixTarget;
  const amount = formatEther(lock?.amount);
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

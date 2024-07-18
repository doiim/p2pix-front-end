import { useEtherStore } from "@/store/ether";
import { Contract, ethers } from "ethers";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { formatEther } from "ethers/lib/utils";
import { getContract } from "./provider";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { getP2PixAddress, getTokenAddress } from "./addresses";
import { NetworkEnum } from "@/model/NetworkEnum";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

const getNetworksLiquidity = async (): Promise<void> => {
  const etherStore = useEtherStore();

  const goerliProvider = new ethers.providers.JsonRpcProvider(
    import.meta.env.VITE_GOERLI_API_URL,
    5
  ); // goerli provider
  const mumbaiProvider = new ethers.providers.JsonRpcProvider(
    import.meta.env.VITE_MUMBAI_API_URL,
    80001
  ); // mumbai provider
  const rootstockProvider = new ethers.providers.JsonRpcProvider(
    import.meta.env.VITE_RSK_API_URL,
    31
  ); // rootstock provider

  const p2pContractGoerli = new ethers.Contract(
    getP2PixAddress(NetworkEnum.ethereum),
    p2pix.abi,
    goerliProvider
  );
  const p2pContractMumbai = new ethers.Contract(
    getP2PixAddress(NetworkEnum.polygon),
    p2pix.abi,
    mumbaiProvider
  );

  const p2pContractRootstock = new ethers.Contract(
    getP2PixAddress(NetworkEnum.rootstock),
    p2pix.abi,
    rootstockProvider
  );

  etherStore.setLoadingNetworkLiquidity(true);
  const depositListGoerli = await getValidDeposits(
    getTokenAddress(NetworkEnum.ethereum),
    p2pContractGoerli
  );

  const depositListMumbai = await getValidDeposits(
    getTokenAddress(NetworkEnum.polygon),
    p2pContractMumbai
  );

  etherStore.setDepositsValidListGoerli(depositListGoerli);
  const depositListRootstock = await getValidDeposits(
    getTokenAddress(NetworkEnum.rootstock),
    p2pContractRootstock
  );
  etherStore.setDepositsValidListMumbai(depositListMumbai);
  etherStore.setDepositsValidListRootstock(depositListRootstock);
  etherStore.setLoadingNetworkLiquidity(false);
};

const getValidDeposits = async (
  token: string,
  contract?: Contract
): Promise<ValidDeposit[]> => {
  let p2pContract: Contract;

  if (contract) {
    p2pContract = contract;
  } else {
    p2pContract = getContract(true);
  }

  const filterDeposits = p2pContract.filters.DepositAdded(null);
  const eventsDeposits = await p2pContract.queryFilter(filterDeposits);

  if (!contract) p2pContract = getContract(); // get metamask provider contract
  const depositList: { [key: string]: ValidDeposit } = {};

  await Promise.all(
    eventsDeposits.map(async (deposit) => {
      // Get liquidity only for the selected token
      if (deposit.args?.token != token) return null;

      const mappedBalance = await p2pContract.getBalance(
        deposit.args?.seller,
        token
      );

      const mappedPixTarget = await p2pContract.getPixTarget(
        deposit.args?.seller,
        token
      );

      let validDeposit: ValidDeposit | null = null;

      if (mappedBalance._hex) {
        validDeposit = {
          token: token,
          blockNumber: deposit.blockNumber,
          remaining: Number(formatEther(mappedBalance._hex)),
          seller: deposit.args?.seller,
          pixKey: Number(mappedPixTarget._hex),
        };
      }

      if (validDeposit)
        depositList[deposit.args?.seller + token] = validDeposit;
    })
  );

  return Object.values(depositList);
};

const getUnreleasedLockById = async (
  lockID: string
): Promise<UnreleasedLock> => {
  const p2pContract = getContract();
  const pixData: Pix = {
    pixKey: "",
  };

  const lock = await p2pContract.mapLocks(lockID);

  const pixTarget = lock.pixTarget;
  const amount = formatEther(lock?.amount);
  pixData.pixKey = String(Number(pixTarget));
  pixData.value = Number(amount);

  return {
    lockID: lockID,
    pix: pixData,
  };
};

export { getValidDeposits, getNetworksLiquidity, getUnreleasedLockById };

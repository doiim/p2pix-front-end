import { useEtherStore } from "@/store/ether";
import { Contract, formatEther, Interface, JsonRpcProvider } from "ethers";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";
import { getContract } from "./provider";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { getP2PixAddress, getTokenAddress } from "./addresses";
import { NetworkEnum } from "@/model/NetworkEnum";
import type { UnreleasedLock } from "@/model/UnreleasedLock";
import type { Pix } from "@/model/Pix";

const getNetworksLiquidity = async (): Promise<void> => {
  const etherStore = useEtherStore();
  const sepoliaProvider = new JsonRpcProvider(
    import.meta.env.VITE_SEPOLIA_API_URL,
    11155111
  ); // sepolia provider
  const rootstockProvider = new JsonRpcProvider(
    import.meta.env.VITE_RSK_API_URL,
    31
  ); // rootstock provider

  const p2pContractSepolia = new Contract(
    getP2PixAddress(NetworkEnum.ethereum),
    p2pix.abi,
    sepoliaProvider
  );
  const p2pContractRootstock = new Contract(
    getP2PixAddress(NetworkEnum.rootstock),
    p2pix.abi,
    rootstockProvider
  );

  etherStore.setLoadingNetworkLiquidity(true);

  const depositListSepolia = await getValidDeposits(
    getTokenAddress(etherStore.selectedToken, NetworkEnum.ethereum),
    p2pContractSepolia
  );
  // const depositListMumbai = await getValidDeposits(
  //   getTokenAddress(etherStore.selectedToken, NetworkEnum.polygon),
  //   p2pContractMumbai
  // );
  const depositListRootstock = await getValidDeposits(
    getTokenAddress(etherStore.selectedToken, NetworkEnum.rootstock),
    p2pContractRootstock
  );

  etherStore.setDepositsValidListSepolia(depositListSepolia);
  // etherStore.setDepositsValidListMumbai(depositListMumbai);
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
    p2pContract = await getContract(true);
  }

  const filterDeposits = p2pContract.filters.DepositAdded(null);
  const eventsDeposits = await p2pContract.queryFilter(filterDeposits);

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
    const mappedPixTarget = await p2pContract.getPixTarget(
      decoded.args.seller,
      token
    );

    let validDeposit: ValidDeposit | null = null;

    if (mappedBalance._hex) {
      validDeposit = {
        token: token,
        blockNumber: deposit.blockNumber,
        remaining: Number(formatEther(mappedBalance._hex)),
        seller: decoded.args.seller,
        pixKey: mappedPixTarget,
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

export { getValidDeposits, getNetworksLiquidity, getUnreleasedLockById };

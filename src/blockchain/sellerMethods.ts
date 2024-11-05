import { getContract, getProvider } from "./provider";
import { getTokenAddress, getP2PixAddress } from "./addresses";

import { encodeBytes32String, Contract, parseEther } from "ethers";

import mockToken from "../utils/smart_contract_files/MockToken.json";
import { useEtherStore } from "@/store/ether";

const approveTokens = async (tokenQty: string): Promise<any> => {
  const provider = getProvider();
  const signer = await provider.getSigner();
  const etherStore = useEtherStore();

  const tokenContract = new Contract(
    getTokenAddress(etherStore.selectedToken),
    mockToken.abi,
    signer
  );

  const apprv = await tokenContract.approve(
    getP2PixAddress(),
    parseEther(tokenQty)
  );

  await apprv.wait();
  return apprv;
};

const addDeposit = async (tokenQty: string, pixKey: string): Promise<any> => {
  const p2pContract = await getContract();
  const etherStore = useEtherStore();

  const deposit = await p2pContract.deposit(
    pixKey,
    encodeBytes32String(""),
    getTokenAddress(etherStore.selectedToken),
    parseEther(tokenQty),
    true
  );

  await deposit.wait();

  return deposit;
};

export { approveTokens, addDeposit };

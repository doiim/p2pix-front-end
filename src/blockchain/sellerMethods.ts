import { getContract, getProvider } from "./provider";
import { getTokenAddress, getP2PixAddress } from "./addresses";

import { encodeBytes32String, Contract, parseEther } from "ethers";

import mockToken from "../utils/smart_contract_files/MockToken.json";
import { useEtherStore } from "@/store/ether";
import { createParticipant, Participant } from "@/utils/bbPay";

const approveTokens = async (participant: Participant): Promise<any> => {
  const provider = getProvider();
  const signer = await provider?.getSigner();
  const etherStore = useEtherStore();

  etherStore.setSeller(participant);
  const tokenContract = new Contract(
    getTokenAddress(etherStore.selectedToken),
    mockToken.abi,
    signer
  );

  // Check if the token is already approved
  const approved = await tokenContract.allowance(
    await signer?.getAddress(),
    getP2PixAddress()
  );
  if (approved < parseEther(participant.offer)) {
    // Approve tokens
    const apprv = await tokenContract.approve(
      getP2PixAddress(),
      parseEther(participant.offer)
    );
    await apprv.wait();
    return true;
  }
  return true;
};

const addDeposit = async (): Promise<any> => {
  const p2pContract = await getContract();
  const etherStore = useEtherStore();

  const sellerId = await createParticipant(etherStore.seller);
  etherStore.setSellerId(sellerId.id);

  const deposit = await p2pContract.deposit(
    sellerId,
    encodeBytes32String(""),
    getTokenAddress(etherStore.selectedToken),
    parseEther(etherStore.seller.offer),
    true
  );

  await deposit.wait();

  return deposit;
};

export { approveTokens, addDeposit };

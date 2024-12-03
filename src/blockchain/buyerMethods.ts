import { getContract, getProvider } from "./provider";
import { getP2PixAddress, getTokenAddress } from "./addresses";
import { encodeBytes32String, Signature, Contract, parseEther } from "ethers";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";

import type { TokenEnum } from "@/model/NetworkEnum";
import { createSolicitation } from "../utils/bbPay";
import type { Offer } from "../utils/bbPay";

const addLock = async (
  sellerId: string,
  token: string,
  amount: number
): Promise<string> => {
  const p2pContract = await getContract();

  const lock = await p2pContract.lock(
    sellerId,
    token,
    parseEther(String(amount)), // BigNumber
    [],
    []
  );

  const lock_rec = await lock.wait();
  const [t] = lock_rec.events;

  const offer: Offer = {
    amount,
    lockId: String(t.args.lockID),
    sellerId: sellerId,
  };
  const solicitation = await createSolicitation(offer);

  return;
};

const releaseLock = async (solicitation: any): Promise<any> => {
  // const mockBacenSigner = new Wallet(
  //   "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  // );

  // const messageToSign = solidityPackedKeccak256(
  //   ["bytes32", "uint256", "bytes32"],
  //   [sellerId, parseEther(String(amount)), encodeBytes32String(signature)]
  // );

  // const messageHashBytes = getBytes(messageToSign);
  // const flatSig = await mockBacenSigner.signMessage(messageHashBytes);

  const provider = getProvider();

  const sig = Signature.from(flatSig);
  console.log(sig);
  const signer = await provider.getSigner();
  const p2pContract = new Contract(getP2PixAddress(), p2pix.abi, signer);

  const release = await p2pContract.release(
    BigInt(lockId),
    encodeBytes32String(e2eId),
    flatSig
  );
  await release.wait();

  return release;
};

const cancelDeposit = async (depositId: bigint): Promise<any> => {
  const contract = await getContract();

  const cancel = await contract.cancelDeposit(depositId);
  await cancel.wait();

  return cancel;
};

const withdrawDeposit = async (
  amount: string,
  token: TokenEnum
): Promise<any> => {
  const contract = await getContract();

  const withdraw = await contract.withdraw(
    getTokenAddress(token),
    parseEther(String(amount)),
    []
  );
  await withdraw.wait();

  return withdraw;
};

export { cancelDeposit, withdrawDeposit, addLock, releaseLock };

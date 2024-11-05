import { getContract, getProvider } from "./provider";
import { getP2PixAddress, getTokenAddress } from "./addresses";

import p2pix from "@/utils/smart_contract_files/P2PIX.json";

import {
  solidityPackedKeccak256,
  encodeBytes32String,
  Signature,
  Contract,
  getBytes,
  Wallet,
  parseEther,
} from "ethers";
import type { TokenEnum } from "@/model/NetworkEnum";

const addLock = async (
  seller: string,
  token: string,
  amount: number
): Promise<string> => {
  const p2pContract = await getContract();

  const lock = await p2pContract.lock(
    seller,
    token,
    parseEther(String(amount)), // BigNumber
    [],
    []
  );

  const lock_rec = await lock.wait();
  const [t] = lock_rec.events;

  return String(t.args.lockID);
};

const releaseLock = async (
  pixKey: string,
  amount: number,
  e2eId: string,
  lockId: string
): Promise<any> => {
  const mockBacenSigner = new Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const messageToSign = solidityPackedKeccak256(
    ["bytes32", "uint256", "bytes32"],
    [pixKey, parseEther(String(amount)), encodeBytes32String(e2eId)]
  );

  const messageHashBytes = getBytes(messageToSign);
  const flatSig = await mockBacenSigner.signMessage(messageHashBytes);
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

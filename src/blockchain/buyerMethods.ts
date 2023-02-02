import { useEtherStore } from "@/store/ether";

import { getContract, getProvider } from "./provider";
import { getP2PixAddress } from "./addresses";

import p2pix from "../utils/smart_contract_files/P2PIX.json";

import { BigNumber, ethers } from "ethers";
import { parseEther } from "ethers/lib/utils";

const addLock = async (
  seller: string,
  token: string,
  amount: number
): Promise<string> => {
  const etherStore = useEtherStore();

  const p2pContract = getContract();

  const lock = await p2pContract.lock(
    seller,
    token,
    etherStore.walletAddress, // String "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" (Example)
    ethers.constants.AddressZero, // String "0x0000000000000000000000000000000000000000"
    0,
    parseEther(String(amount)), // BigNumber
    [],
    []
  );

  const lock_rec = await lock.wait();
  const [t] = lock_rec.events;

  return t.args.lockID;
};

const releaseLock = async (
  pixKey: number,
  amount: number,
  e2eId: string,
  lockId: string
): Promise<any> => {
  const mockBacenSigner = new ethers.Wallet(
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
  );

  const messageToSign = ethers.utils.solidityKeccak256(
    ["string", "uint256", "bytes32"],
    [
      pixKey,
      parseEther(String(amount)),
      ethers.utils.formatBytes32String(e2eId),
    ]
  );

  const messageHashBytes = ethers.utils.arrayify(messageToSign);
  const flatSig = await mockBacenSigner.signMessage(messageHashBytes);
  const provider = getProvider();

  const sig = ethers.utils.splitSignature(flatSig);

  const signer = provider.getSigner();
  const p2pContract = new ethers.Contract(getP2PixAddress(), p2pix.abi, signer);

  const release = await p2pContract.release(
    lockId,
    ethers.constants.AddressZero,
    ethers.utils.formatBytes32String(e2eId),
    sig.r,
    sig.s,
    sig.v
  );
  await release.wait();

  return release;
};

const cancelDeposit = async (depositId: BigNumber): Promise<any> => {
  const contract = getContract();

  const cancel = await contract.cancelDeposit(depositId);
  await cancel.wait();

  return cancel;
};

const withdrawDeposit = async (
  depositId: BigNumber,
  amount: string
): Promise<any> => {
  const contract = getContract();

  const withdraw = await contract.withdraw(depositId, amount, []);
  await withdraw.wait();

  return withdraw;
};

export { cancelDeposit, withdrawDeposit, addLock, releaseLock };

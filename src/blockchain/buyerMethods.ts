import { getContract } from './provider';
import { p2PixAbi } from './abi';
import { getSender, sendContractCalls, type Sender } from './send';
import type { PixProof } from '@/utils/pixProof';
import {
  type Abi,
  type ContractFunctionReturnType,
  decodeEventLog,
  parseEther,
  type Address,
  type Log,
  type TransactionReceipt,
} from 'viem';

/**
 * The lock is already funded on-chain, so callers must recover its id instead
 * of treating this as a failed lock and abandoning the funds.
 */
export class LockIdUnrecoverableError extends Error {
  constructor() {
    super('Lock was created but its id could not be recovered from the logs');
    this.name = 'LockIdUnrecoverableError';
  }
}

/**
 * UserOperation receipts do not expose a contract return value. Recover the
 * lock id from the P2Pix event while ignoring EntryPoint and Kernel logs.
 *
 * `logs` must be the logs scoped to our own UserOperation (bundle-wide logs
 * can carry another account's locks). Scanned newest-first so that a bundle
 * holding two identical locks from this account still yields ours, which is
 * the last one written.
 */
const getLockIdFromLogs = (
  abi: readonly unknown[],
  logs: readonly Log[],
  buyer: Address,
  seller: Address,
  amount: bigint,
  contractAddress: Address,
): bigint => {
  for (const log of [...logs].reverse()) {
    if (log.address.toLowerCase() !== contractAddress.toLowerCase()) continue;
    try {
      const event = decodeEventLog({
        abi: abi as Abi,
        data: log.data,
        topics: log.topics,
      });
      if (event.eventName !== 'LockAdded') continue;
      const args = event.args as {
        buyer?: Address;
        seller?: Address;
        amount?: bigint;
        lockID?: bigint;
      };
      if (
        args.buyer?.toLowerCase() === buyer.toLowerCase() &&
        args.seller?.toLowerCase() === seller.toLowerCase() &&
        args.amount === amount &&
        args.lockID !== undefined
      ) {
        return args.lockID;
      }
    } catch {
      // Not a P2Pix event.
    }
  }
  throw new LockIdUnrecoverableError();
};

/** `mapLocks`'s output names, taken from the ABI. */
type MapLocksOutputName = Extract<
  (typeof p2PixAbi)[number],
  { name: 'mapLocks'; type: 'function' }
>['outputs'][number]['name'];

/** Name `mapLocks`'s positional tuple so index shifts become type errors. The
 * `satisfies` ties the keys to the ABI: renaming an output in the contract
 * fails to compile here instead of silently mislabelling a field. */
export const toLock = (
  r: ContractFunctionReturnType<typeof p2PixAbi, 'view', 'mapLocks'>,
) =>
  ({
    counter: r[0],
    expirationBlock: r[1],
    pixTarget: r[2],
    amount: r[3],
    token: r[4],
    buyerAddress: r[5],
    seller: r[6],
  }) satisfies Record<MapLocksOutputName, unknown>;

export const addLock = async (
  sellerAddress: Address,
  tokenAddress: Address,
  amount: number,
): Promise<bigint> => {
  const from = await getSender();
  const { address, abi } = await getContract();
  const parsedAmount = parseEther(amount.toString());

  // `lockID = ++lockCounter` is global, so a simulated return value belongs to
  // whichever lock lands first. Read the id our own tx actually wrote.
  const { sender, success, receipt, logs } = await sendContractCalls(from, [
    {
      address,
      abi,
      functionName: 'lock',
      args: [sellerAddress, tokenAddress, parsedAmount, [], []],
    },
  ]);
  if (!success) {
    throw new Error(`Falha na reserva: ${receipt.transactionHash}`);
  }

  return getLockIdFromLogs(
    abi,
    logs,
    sender,
    sellerAddress,
    parsedAmount,
    address,
  );
};

/** `sender` is resolved by the caller, before it reads anything for the call. */
export const withdrawDeposit = async (
  sender: Sender,
  amount: string,
  token: Address,
  expiredLocks: bigint[] = [],
): Promise<boolean> => {
  const { address, abi } = await getContract();
  const { success } = await sendContractCalls(sender, [
    {
      address,
      abi,
      functionName: 'withdraw',
      args: [token, parseEther(amount), expiredLocks],
    },
  ]);
  return success;
};

/** Releases the lock with the prover's proof of Pix payment. */
export const releaseLock = async (
  lockID: bigint,
  proof: PixProof,
): Promise<TransactionReceipt> => {
  const sender = await getSender();
  const { address, abi, client } = await getContract();

  // `release` always pays the lock's buyer, whoever submits it; only the
  // buyer's own account should spend gas on it.
  const lock = await client.readContract({
    address,
    abi,
    functionName: 'mapLocks',
    args: [lockID],
  });
  const { buyerAddress } = toLock(lock);
  if (buyerAddress.toLowerCase() !== sender.address.toLowerCase()) {
    throw new Error('A conta conectada não é a compradora desta reserva');
  }

  const { success, receipt } = await sendContractCalls(sender, [
    {
      address,
      abi,
      functionName: 'release',
      args: [lockID, proof],
    },
  ]);
  if (!success) {
    throw new Error(`Falha na liberação: ${receipt.transactionHash}`);
  }
  return receipt;
};

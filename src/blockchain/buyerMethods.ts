import { getContract, getPublicClient } from './provider';
import { p2PixAbi } from './abi';
import type { AaCall } from './aa/types';
import { findAllowlistProof } from './allowlist';
import { getSender, sendContractCalls, type Sender } from './send';
import { causeChain } from './reputation';
import { NotLockBuyerError, type PixProof } from '@/utils/pixProof';
import {
  type Abi,
  type ContractFunctionReturnType,
  ContractFunctionRevertedError,
  decodeEventLog,
  encodeFunctionData,
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
  skipAllowlist = false,
): Promise<bigint> => {
  const from = await getSender();
  const { address, abi } = await getContract();
  const parsedAmount = parseEther(amount.toString());
  const proof = skipAllowlist
    ? []
    : await findAllowlistProof(sellerAddress, from.address);

  // `lockID = ++lockCounter` is global, so a simulated return value belongs to
  // whichever lock lands first. Read the id our own tx actually wrote.
  const { sender, success, receipt, logs } = await sendContractCalls(from, [
    {
      address,
      abi,
      functionName: 'lock',
      args: [sellerAddress, tokenAddress, parsedAmount, proof, []],
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

/**
 * `release` always pays the lock's buyer, whoever submits it; only the buyer's
 * own account should spend gas on it.
 */
export const getBuyerLock = async (lockID: bigint, buyer: Address) => {
  const { address, abi, client } = await getContract(true);
  const lock = toLock(
    await client.readContract({
      address,
      abi,
      functionName: 'mapLocks',
      args: [lockID],
    }),
  );
  if (lock.buyerAddress.toLowerCase() !== buyer.toLowerCase()) {
    throw new NotLockBuyerError();
  }
  return lock;
};

/** The `release` call itself, for batching with the calls that follow it. */
export const releaseCall = async (
  lockID: bigint,
  proof: PixProof,
): Promise<AaCall> => {
  const { address, abi } = await getContract(true);
  return {
    to: address,
    data: encodeFunctionData({
      abi: abi as Abi,
      functionName: 'release',
      args: [lockID, proof],
    }),
    value: 0n,
  };
};

/**
 * A UserOperation that failed carries no revert reason; simulating `release`
 * from the same smart account names it. If the simulation passes (the state
 * changed since), `failure` stays the generic one.
 */
const explainReleaseFailure = async (
  sender: Sender,
  release: { address: Address; abi: Abi; args: readonly [bigint, PixProof] },
  failure: Error,
): Promise<Error> => {
  const simulated = await getPublicClient(sender.chainId)
    .simulateContract({
      account: sender.address,
      address: release.address,
      abi: release.abi,
      functionName: 'release',
      args: release.args,
    })
    .then(
      () => null,
      (cause: unknown) => cause,
    );
  const reverted = causeChain(simulated, 10).some(
    (e) => e instanceof ContractFunctionRevertedError,
  );
  return reverted ? new Error(failure.message, { cause: simulated }) : failure;
};

/**
 * Releases the lock with the prover's proof of Pix payment. `afterRelease`
 * calls ride in the same UserOperation as the release (the
 * smart-account rail only), e.g. the swap's approve + pre-signature.
 */
export const releaseLock = async (
  lockID: bigint,
  proof: PixProof,
  afterRelease: readonly AaCall[] = [],
): Promise<TransactionReceipt> => {
  const sender = await getSender();
  const { address, abi } = await getContract();
  await getBuyerLock(lockID, sender.address);

  // The swap's approve + pre-signature ride the release UserOperation: smart account only.
  const release = { address, abi, args: [lockID, proof] } as const;
  const { success, receipt } = await sendContractCalls(
    sender,
    [{ ...release, functionName: 'release' }, ...afterRelease],
    { aaOnly: afterRelease.length > 0 },
  ).catch(async (cause) => {
    throw sender.isSmartAccount
      ? await explainReleaseFailure(sender, release, cause)
      : cause;
  });
  if (!success) {
    const failure = new Error(`Falha na liberação: ${receipt.transactionHash}`);
    throw sender.isSmartAccount
      ? await explainReleaseFailure(sender, release, failure)
      : failure;
  }
  return receipt;
};

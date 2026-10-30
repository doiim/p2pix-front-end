import { getContract } from './provider';
import { p2PixAbi } from './abi';
import { getActiveAaContext, sendAaOperation } from './aa/operations';
import type { AaCall } from './aa/types';
import { findAllowlistProof } from './allowlist';
import type { PixProof } from '@/utils/pixProof';
import {
  type Abi,
  type ContractFunctionReturnType,
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
): Promise<bigint> => {
  const { address, abi, wallet, client, account } = await getContract();
  const parsedAmount = parseEther(amount.toString());
  const aa = await getActiveAaContext();

  if (aa) {
    const proof = await findAllowlistProof(sellerAddress, aa.account.address);
    const call: AaCall = {
      to: address,
      data: encodeFunctionData({
        abi: abi as Abi,
        functionName: 'lock',
        args: [sellerAddress, tokenAddress, parsedAmount, proof, []],
      }),
      value: 0n,
    };
    const aaReceipt = await sendAaOperation(aa, [call], tokenAddress);
    if (!aaReceipt.success) {
      throw new Error(`AA lock failed: ${aaReceipt.receipt.transactionHash}`);
    }

    return getLockIdFromLogs(
      abi,
      aaReceipt.logs,
      aa.account.address,
      sellerAddress,
      parsedAmount,
      address,
    );
  }

  if (!wallet) throw new Error('Carteira não conectada');
  if (!account) throw new Error('Account not available');

  const proof = await findAllowlistProof(sellerAddress, account);
  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'lock',
    args: [sellerAddress, tokenAddress, parsedAmount, proof, []],
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${receipt.transactionHash}`);
  }

  // `lockID = ++lockCounter` is global, so a simulated return value belongs to
  // whichever lock lands first. Read the id our own tx actually wrote.
  return getLockIdFromLogs(
    abi,
    receipt.logs,
    account,
    sellerAddress,
    parsedAmount,
    address,
  );
};

export const withdrawDeposit = async (
  amount: string,
  token: Address,
  expiredLocks: bigint[] = [],
): Promise<boolean> => {
  const { address, abi, wallet, client, account } = await getContract();
  const parsedAmount = parseEther(amount);
  const aa = await getActiveAaContext();

  if (aa) {
    const call: AaCall = {
      to: address,
      data: encodeFunctionData({
        abi: abi as Abi,
        functionName: 'withdraw',
        args: [token, parsedAmount, expiredLocks],
      }),
      value: 0n,
    };
    const aaReceipt = await sendAaOperation(aa, [call], token);
    return aaReceipt.success;
  }

  if (!wallet) throw new Error('Carteira não conectada');
  if (!account) throw new Error('Account not available');

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'withdraw',
    args: [token, parsedAmount, expiredLocks],
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  return receipt.status === 'success';
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
    throw new Error('Account is not the buyer of this lock');
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
 * Releases the lock with the prover's proof of Pix payment. `afterRelease`
 * calls ride in the same UserOperation as the release (the
 * smart-account rail only), e.g. the swap's approve + pre-signature.
 */
export const releaseLock = async (
  lockID: bigint,
  proof: PixProof,
  afterRelease: readonly AaCall[] = [],
): Promise<TransactionReceipt> => {
  const { address, abi, wallet, client, account } = await getContract();
  const aa = await getActiveAaContext();

  if (aa) {
    const lock = await getBuyerLock(lockID, aa.account.address);
    const aaReceipt = await sendAaOperation(
      aa,
      [await releaseCall(lockID, proof), ...afterRelease],
      lock.token,
    );
    if (!aaReceipt.success) {
      throw new Error(
        `AA release failed: ${aaReceipt.receipt.transactionHash}`,
      );
    }
    return aaReceipt.receipt;
  }

  if (!wallet) throw new Error('Carteira não conectada');
  if (!account) throw new Error('Account not available');
  await getBuyerLock(lockID, account);

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'release',
    args: [lockID, proof],
    account,
  });
  const hash = await wallet.writeContract(request);
  return client.waitForTransactionReceipt({ hash });
};

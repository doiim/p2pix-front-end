import {
  encodeFunctionData,
  isAddressEqual,
  type Abi,
  type Address,
  type Log,
  type TransactionReceipt,
} from 'viem';
import { getContract } from './provider';
import {
  getActiveAaContext,
  sendAaOperation,
  type AaOutflow,
} from './aa/operations';
import type { AaCall, AaContext } from './aa/types';

export type ContractCall = {
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
};

export type SendResult = {
  sender: Address;
  success: boolean;
  /** AA: the bundle receipt. EOA: the last transaction's receipt. */
  receipt: TransactionReceipt;
  /** AA: logs of our own UserOperation. EOA: logs of every transaction sent. */
  logs: readonly Log[];
};

export type Sender = {
  address: Address;
  isSmartAccount: boolean;
  chainId: number;
};

/**
 * The account that will send, on the same rail `sendContractCalls` uses.
 * Resolve it before building calls: `sendContractCalls` refuses to send when
 * the network or account changed since.
 */
export const getSender = async (): Promise<Sender> => {
  const aa = await getActiveAaContext();
  if (aa) {
    return {
      address: aa.account.address,
      isSmartAccount: true,
      chainId: aa.network.id,
    };
  }

  const { wallet, account } = await getContract();
  if (!wallet?.chain || !account) throw new Error('Carteira não conectada');
  return { address: account, isSmartAccount: false, chainId: wallet.chain.id };
};

// Calls carry the addresses of the network they were built on; the rail
// resolved at send time follows the live network selection.
const assertSender = (
  from: Sender,
  address: Address,
  ...chainIds: (number | undefined)[]
) => {
  if (
    chainIds.some((id) => id !== from.chainId) ||
    !isAddressEqual(from.address, address)
  ) {
    throw new Error('A conta ou a rede mudou; tente novamente');
  }
};

const sendOnAaRail = async (
  aa: AaContext,
  calls: readonly AaCall[],
  outflow?: AaOutflow,
): Promise<SendResult> => {
  const op = await sendAaOperation(aa, calls, outflow);
  return {
    sender: aa.account.address,
    success: op.success,
    receipt: op.receipt,
    logs: op.logs,
  };
};

/**
 * Smart-account-only variant for calls that are already encoded (e.g. a
 * module install the account sends to itself). An EOA has no such call, so
 * there is no EOA rail here: it throws instead of falling back.
 */
export const sendRawAaCalls = async (
  calls: readonly AaCall[],
): Promise<SendResult> => {
  const aa = await getActiveAaContext();
  if (!aa) throw new Error('Conta inteligente indisponível');
  return sendOnAaRail(aa, calls);
};

/**
 * Single entry point for sending transactions, from the `from` account on the
 * network it was resolved on (see `getSender`). Smart account: all calls go in
 * one UserOperation. Regular wallet: each call is simulated, written and
 * awaited in order, stopping at the first one that does not succeed.
 * `outflow`: token the batch moves out of the smart account (see `AaOutflow`).
 */
export const sendContractCalls = async (
  from: Sender,
  calls: readonly ContractCall[],
  outflow?: AaOutflow,
): Promise<SendResult> => {
  const aa = await getActiveAaContext();
  if (aa) {
    // The context's clients are bound to `aa.network`, so a switch after this
    // check cannot move the operation to another chain.
    assertSender(from, aa.account.address, aa.network.id);
    return sendOnAaRail(
      aa,
      calls.map((call) => ({
        to: call.address,
        value: 0n,
        data: encodeFunctionData({
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        }),
      })),
      outflow,
    );
  }

  const { wallet, client, account } = await getContract();
  if (!wallet || !account) throw new Error('Carteira não conectada');
  // Both clients are bound to their chain, and viem refuses a write when the
  // wallet itself sits on another one.
  assertSender(from, account, wallet.chain?.id, client.chain?.id);

  const logs: Log[] = [];
  let receipt: TransactionReceipt | undefined;
  let ok = true;
  for (const call of calls) {
    const { request } = await client.simulateContract({ ...call, account });
    const hash = await wallet.writeContract(request);
    // The wallet can replace a pending transaction: a speed-up still counts, a
    // cancel (zero-value self-send) or any other replacement means the call
    // did not run, whatever the replacement's own receipt says.
    let replacement: string | undefined;
    receipt = await client.waitForTransactionReceipt({
      hash,
      onReplaced: (replaced) => (replacement = replaced.reason),
    });
    if (replacement === 'cancelled') {
      throw new Error('Transação cancelada na carteira.');
    }
    logs.push(...receipt.logs);
    ok =
      receipt.status === 'success' &&
      (replacement ?? 'repriced') === 'repriced';
    if (!ok) break;
  }
  if (!receipt) throw new Error('Nenhuma chamada para enviar');
  return {
    sender: account,
    success: ok,
    receipt,
    logs,
  };
};

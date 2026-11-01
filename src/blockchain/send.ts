import {
  encodeFunctionData,
  isAddressEqual,
  type Abi,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
  type TransactionReceipt,
  type WalletClient,
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

export type SendOptions = {
  /** Token the batch moves out of the smart account (see `AaOutflow`). */
  outflow?: AaOutflow;
  /** Called once the send is submitted (UserOperation accepted, or transaction hash), before its receipt. */
  onSent?: () => void;
  /** Refuse to send without a smart account: calls only a Kernel account can make. */
  aaOnly?: boolean;
};

export type SendResult = {
  sender: Address;
  success: boolean;
  /** AA: the UserOperation hash. EOA: the last transaction's hash. */
  hash: Hex;
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

const isEncodedCall = (call: ContractCall | AaCall): call is AaCall =>
  'to' in call;

const encodeCall = (call: ContractCall | AaCall): AaCall =>
  isEncodedCall(call)
    ? call
    : {
        to: call.address,
        value: 0n,
        data: encodeFunctionData({
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        }),
      };

const sendOnAaRail = async (
  aa: AaContext,
  calls: readonly (ContractCall | AaCall)[],
  { outflow, onSent }: SendOptions,
): Promise<SendResult> => {
  const op = await sendAaOperation(aa, calls.map(encodeCall), outflow, onSent);
  return {
    sender: aa.account.address,
    success: op.success,
    hash: op.userOpHash,
    receipt: op.receipt,
    logs: op.logs,
  };
};

type EoaSigner = {
  wallet: WalletClient;
  client: PublicClient;
  account: Address;
};

// An encoded call (native coin, swap pre-signature) is sent as is; a contract
// call is simulated first, so a revert names its reason before the wallet prompts.
const submitEoaCall = async (
  { wallet, client, account }: EoaSigner,
  call: ContractCall | AaCall,
): Promise<Hex> => {
  if (isEncodedCall(call)) {
    return wallet.sendTransaction({ ...call, account, chain: wallet.chain });
  }
  const { request } = await client.simulateContract({ ...call, account });
  return wallet.writeContract(request);
};

// The wallet can replace a pending transaction: a speed-up still counts, a
// cancel (or any other replacement) means the call did not run.
const waitEoaReceipt = async (
  { client }: EoaSigner,
  hash: Hex,
): Promise<{ receipt: TransactionReceipt; ok: boolean }> => {
  let replacement: string | undefined;
  const receipt = await client.waitForTransactionReceipt({
    hash,
    onReplaced: (replaced) => (replacement = replaced.reason),
  });
  const replaced = replacement !== undefined && replacement !== 'repriced';
  return { receipt, ok: receipt.status === 'success' && !replaced };
};

const sendOnEoaRail = async (
  from: Sender,
  calls: readonly (ContractCall | AaCall)[],
  { onSent }: SendOptions,
): Promise<SendResult> => {
  const { wallet, client, account } = await getContract();
  if (!wallet || !account) throw new Error('Carteira não conectada');
  // Both clients are bound to their chain, and viem refuses a write when the
  // wallet itself sits on another one.
  assertSender(from, account, wallet.chain?.id, client.chain?.id);
  const signer = { wallet, client, account };

  const logs: Log[] = [];
  let sent: { hash: Hex; receipt: TransactionReceipt; ok: boolean } | undefined;
  for (const call of calls) {
    const hash = await submitEoaCall(signer, call);
    onSent?.();
    sent = { hash, ...(await waitEoaReceipt(signer, hash)) };
    logs.push(...sent.receipt.logs);
    if (!sent.ok) break;
  }
  if (!sent) throw new Error('Nenhuma chamada para enviar');
  return {
    sender: account,
    success: sent.ok,
    hash: sent.hash,
    receipt: sent.receipt,
    logs,
  };
};

/**
 * Single entry point for sending transactions, from the `from` account on the
 * network it was resolved on (see `getSender`). Smart account: all calls go in
 * one UserOperation. Regular wallet: each call is sent and awaited in order
 * (contract calls simulated first), stopping at the first one that does not
 * succeed. `aaOnly` refuses the wallet rail for calls only a Kernel can make.
 */
export const sendContractCalls = async (
  from: Sender,
  calls: readonly (ContractCall | AaCall)[],
  options: SendOptions = {},
): Promise<SendResult> => {
  const aa = await getActiveAaContext();
  if (aa) {
    // The context's clients are bound to `aa.network`, so a switch after this
    // check cannot move the operation to another chain.
    assertSender(from, aa.account.address, aa.network.id);
    return sendOnAaRail(aa, calls, options);
  }
  if (options.aaOnly) throw new Error('Conta inteligente indisponível');
  return sendOnEoaRail(from, calls, options);
};

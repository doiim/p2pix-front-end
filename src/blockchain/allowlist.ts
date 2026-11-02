import { encodeFunctionData, zeroHash, type Address, type Hex } from 'viem';
import { getContract } from './provider';
import {
  feeTokenAddress,
  getActiveAaContext,
  sendAaOperation,
} from './aa/operations';
import type { AaCall } from './aa/types';
import { allowlistProof, allowlistRoot, sameAddress } from '@/utils/allowlist';
import {
  addressesOf,
  readOwnAllowlist,
  readReceivedAllowlists,
} from '@/utils/allowlistStorage';
import { useUser } from '@/composables/useUser';

export const readAllowlistRoot = async (seller: Address): Promise<Hex> => {
  const { address, abi, client } = await getContract(true);
  return client.readContract({
    address,
    abi,
    functionName: 'sellerAllowList',
    args: [seller],
  });
};

/** `setRoot` only accepts the caller's own address, so the root is per account. */
export const writeAllowlistRoot = async (root: Hex): Promise<void> => {
  const { address, abi, wallet, client, account } = await getContract();
  const aa = await getActiveAaContext();

  if (aa) {
    const call: AaCall = {
      to: address,
      value: 0n,
      data: encodeFunctionData({
        abi,
        functionName: 'setRoot',
        args: [aa.account.address, root],
      }),
    };
    const receipt = await sendAaOperation(aa, [call], feeTokenAddress(aa));
    if (!receipt.success) {
      throw new Error(`AA setRoot failed: ${receipt.receipt.transactionHash}`);
    }
    return;
  }

  if (!wallet) throw new Error('Wallet not connected');
  if (!account) throw new Error('Account not available');

  const { request } = await client.simulateContract({
    address,
    abi,
    functionName: 'setRoot',
    args: [account, root],
    account,
  });
  const hash = await wallet.writeContract(request);
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction failed: ${receipt.transactionHash}`);
  }
};

/**
 * Proof that lets `buyer` lock above the reputation limit with this seller,
 * taken from a list saved in this browser whose root matches the seller's
 * on-chain root. Empty when there is none, which keeps the normal limit.
 */
export const findAllowlistProof = async (
  seller: Address,
  buyer: Address,
): Promise<Hex[]> => {
  const chainId = useUser().network.value.id;
  // The proof only lifts a limit; a failed read must not block the lock.
  const root = await readAllowlistRoot(seller).catch(() => zeroHash);
  if (root === zeroHash) return [];

  const received = readReceivedAllowlists().filter(
    (list) => list.chainId === chainId && sameAddress(list.seller, seller),
  );
  const candidates = [
    addressesOf(readOwnAllowlist(chainId, seller)),
    ...received.map((list) => addressesOf(list.entries)),
  ];
  const list = candidates.find(
    (addresses) => allowlistRoot(addresses) === root,
  );
  return (list && allowlistProof(list, buyer)) ?? [];
};

import { zeroHash, type Address, type Hex } from 'viem';
import { getContract } from './provider';
import { getSender, sendContractCalls } from './send';
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
  const sender = await getSender();
  const { address, abi } = await getContract();
  const { success, receipt } = await sendContractCalls(sender, [
    { address, abi, functionName: 'setRoot', args: [sender.address, root] },
  ]);
  if (!success) {
    throw new Error(`Falha ao gravar a lista: ${receipt.transactionHash}`);
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

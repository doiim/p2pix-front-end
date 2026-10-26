import { getContract, getPublicClient } from './provider';
import { parseEther, toHex, ChainContract, erc20Abi } from 'viem';
import { useUser } from '@/composables/useUser';
import { createParticipant } from '@/utils/bbPay';
import type { Participant } from '@/utils/bbPay';
import type { Address } from 'viem';
import { getSender, sendContractCalls, type ContractCall } from './send';

const getP2PixAddress = (): Address => {
  const user = useUser();
  return (user.network.value.contracts?.p2pix as ChainContract).address;
};

const getSellerToken = (): Address => {
  const user = useUser();
  return user.network.value.tokens[user.selectedToken.value].address;
};

const readAllowance = async (owner: Address): Promise<bigint> => {
  return getPublicClient().readContract({
    address: getSellerToken(),
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, getP2PixAddress()],
  });
};

const approveCall = (amount: bigint): ContractCall => ({
  address: getSellerToken(),
  abi: erc20Abi,
  functionName: 'approve',
  args: [getP2PixAddress(), amount],
});

/**
 * Records the offer. On the smart-account rail the approval is batched into
 * the deposit's own UserOperation; the regular-wallet path sends its own
 * approval transaction here, which must succeed before the deposit.
 */
const approveTokens = async (participant: Participant): Promise<void> => {
  const user = useUser();
  user.setSeller(participant);

  const offer = parseEther(participant.offer.toString());
  const sender = await getSender();
  if (sender.isSmartAccount) return;

  if ((await readAllowance(sender.address)) < offer) {
    const { success, receipt } = await sendContractCalls(sender, [
      approveCall(offer),
    ]);
    if (!success) {
      throw new Error(`Falha na aprovação: ${receipt.transactionHash}`);
    }
  }
};

const addDeposit = async (): Promise<unknown> => {
  const sender = await getSender();
  const { address, abi } = await getContract();
  const user = useUser();

  // `seller` starts as an empty object (useUser), not null.
  if (!user.seller.value.offer) throw new Error('Informe o valor da oferta');
  const offer = parseEther(user.seller.value.offer.toString());
  const token = getSellerToken();

  const sellerId = await createParticipant(user.seller.value);
  user.setSellerId(sellerId.id);
  if (!sellerId.id) {
    throw new Error('Falha ao cadastrar o vendedor');
  }

  const depositCall: ContractCall = {
    address,
    abi,
    functionName: 'deposit',
    args: [
      sender.chainId + '-' + sellerId.id,
      toHex('', { size: 32 }),
      token,
      offer,
      true,
    ],
  };

  // One UserOperation for both calls: the deposit would revert on its own if
  // the allowance were granted in a separate operation that lands later. A
  // regular wallet already approved in its own step (approveTokens).
  const calls =
    sender.isSmartAccount && (await readAllowance(sender.address)) < offer
      ? [approveCall(offer), depositCall]
      : [depositCall];

  // `deposit` pulls the offer with `transferFrom` inside the contract.
  const { success, receipt } = await sendContractCalls(sender, calls, {
    token,
    amount: offer,
  });
  if (!success) {
    throw new Error(`Falha no depósito: ${receipt.transactionHash}`);
  }
  return receipt;
};

export { approveTokens, addDeposit };

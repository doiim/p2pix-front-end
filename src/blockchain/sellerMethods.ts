import { getContract, getPublicClient, getWalletClient } from './provider';
import {
  encodeFunctionData,
  parseUnits,
  toHex,
  ChainContract,
  erc20Abi,
} from 'viem';
import { useUser } from '@/composables/useUser';
import { createParticipant } from '@/utils/bbPay';
import type { Participant } from '@/utils/bbPay';
import type { Abi, Address } from 'viem';
import { getActiveAaContext, sendAaOperation } from './aa/operations';
import type { AaCall } from './aa/types';
import { TokenEnum, type TokenConfig } from '@/model/NetworkEnum';

const getP2PixAddress = (): Address => {
  const user = useUser();
  return (user.network.value.contracts?.p2pix as ChainContract).address;
};

const getSellerToken = (): TokenConfig => {
  const user = useUser();
  const token = user.network.value.tokens[user.selectedToken.value];
  if (!token) {
    throw new Error(
      `${user.selectedToken.value} is not listed on this network`,
    );
  }
  return token;
};

const readAllowance = async (owner: Address): Promise<bigint> => {
  return getPublicClient().readContract({
    address: getSellerToken().address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner, getP2PixAddress()],
  });
};

const approveCall = (amount: bigint): AaCall => ({
  to: getSellerToken().address,
  value: 0n,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [getP2PixAddress(), amount],
  }),
});

/**
 * On the smart-account rail the approval is batched into the deposit's own
 * UserOperation, so there is nothing to do here. The EOA path still needs its
 * own approval transaction.
 */
const approveTokens = async (participant: Participant): Promise<boolean> => {
  const user = useUser();

  const offer = parseUnits(
    participant.offer.toString(),
    getSellerToken().decimals,
  );
  const aa = await getActiveAaContext();
  if (aa) return true;

  const publicClient = getPublicClient();
  const walletClient = await getWalletClient();
  if (!publicClient || !walletClient) {
    throw new Error('Clients not initialized');
  }

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('Account not available');

  if ((await readAllowance(account)) < offer) {
    const hash = await walletClient.writeContract({
      address: getSellerToken().address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [getP2PixAddress(), offer],
      account,
      chain: user.network.value,
    });
    await publicClient.waitForTransactionReceipt({ hash });
  }

  return true;
};

const addDeposit = async (participant: Participant): Promise<unknown> => {
  const { address, abi, client } = await getContract();
  const user = useUser();
  const aa = await getActiveAaContext();

  const token = getSellerToken();
  const offer = parseUnits(participant.offer.toString(), token.decimals);

  const sellerId = await createParticipant(participant);
  if (!sellerId.id) {
    throw new Error('Failed to create participant');
  }

  const depositArgs = [
    user.network.value.id + '-' + sellerId.id,
    toHex('', { size: 32 }),
    token.address,
    offer,
    true,
  ] as const;

  if (aa) {
    const depositCall: AaCall = {
      to: address,
      value: 0n,
      data: encodeFunctionData({
        abi: abi as Abi,
        functionName: 'deposit',
        args: depositArgs,
      }),
    };

    // One UserOperation for both calls: the deposit would revert on its own if
    // the allowance were granted in a separate operation that lands later.
    const calls =
      (await readAllowance(aa.account.address)) < offer
        ? [approveCall(offer), depositCall]
        : [depositCall];

    // P2Pix's `deposit` pulls the seller token via `transferFrom` from inside
    // the contract, not as a call in this batch. When the deposited token is
    // also the fee token Pimlico charges in, the batch will move that much
    // fee token out of the smart account, so the paymaster quote must be
    // told about it.
    const feeTokenAddress = user.network.value.tokens[TokenEnum.BRZ].address;
    const feeTokenOutflow =
      token.address.toLowerCase() === feeTokenAddress.toLowerCase()
        ? offer
        : 0n;
    const aaReceipt = await sendAaOperation(aa, calls, feeTokenOutflow);
    if (!aaReceipt.success) {
      throw new Error(
        `AA deposit failed: ${aaReceipt.receipt.transactionHash}`,
      );
    }
    return aaReceipt.receipt;
  }

  const walletClient = await getWalletClient();
  if (!walletClient) {
    throw new Error('Wallet client not initialized');
  }

  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('Account not available');

  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'deposit',
    args: depositArgs,
    account,
    chain: user.network.value,
  });

  return client.waitForTransactionReceipt({ hash });
};

export { approveTokens, addDeposit };

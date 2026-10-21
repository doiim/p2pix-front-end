import { getContract, getPublicClient, getWalletClient } from './provider';
import {
  encodeFunctionData,
  parseEther,
  toHex,
  zeroAddress,
  ChainContract,
  erc20Abi,
} from 'viem';
import { useUser } from '@/composables/useUser';
import { createParticipant } from '@/utils/bbPay';
import type { Participant } from '@/utils/bbPay';
import type { Abi, Address, Hex } from 'viem';
import { getActiveAaContext, sendAaOperation } from './aa/operations';
import type { AaCall } from './aa/types';

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

const approveCall = (amount: bigint): AaCall => ({
  to: getSellerToken(),
  value: 0n,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'approve',
    args: [getP2PixAddress(), amount],
  }),
});

/**
 * On the smart-account rail the approval is batched into the deposit's own
 * UserOperation, so this only records the offer and confirms the account can
 * cover it. The EOA path still needs its own approval transaction.
 */
const approveTokens = async (participant: Participant): Promise<boolean> => {
  const user = useUser();
  user.setSeller(participant);

  const offer = parseEther(participant.offer.toString());
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
      address: getSellerToken(),
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

const addDeposit = async (): Promise<unknown> => {
  const { address, abi, client } = await getContract();
  const user = useUser();
  const aa = await getActiveAaContext();

  const offer = parseEther(user.seller.value.offer.toString());
  const token = getSellerToken();

  const sellerId = await createParticipant(user.seller.value);
  user.setSellerId(sellerId.id);
  if (!sellerId.id) {
    throw new Error('Failed to create participant');
  }

  const depositArgs = [
    user.network.value.id + '-' + sellerId.id,
    toHex('', { size: 32 }),
    token,
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
    const feeToken = user.network.value.aa?.feeToken;
    const feeTokenOutflow =
      feeToken &&
      token.toLowerCase() ===
        user.network.value.tokens[feeToken].address.toLowerCase()
        ? offer
        : 0n;
    const aaReceipt = await sendAaOperation(aa, calls, token, feeTokenOutflow);
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

/** The seller's allow-list root on the current network; zero for none. */
const getAllowListRoot = async (seller: Address): Promise<Hex> => {
  const { address, abi, client } = await getContract(true);
  return client.readContract({
    address,
    abi,
    functionName: 'sellerAllowList',
    args: [seller],
  });
};

/** Replaces the connected seller's allow-list root; zero turns it off. */
const setAllowListRoot = async (root: Hex): Promise<void> => {
  const { address, abi, client } = await getContract();
  const user = useUser();
  const aa = await getActiveAaContext();

  if (aa) {
    const call: AaCall = {
      to: address,
      value: 0n,
      data: encodeFunctionData({
        abi: abi as Abi,
        functionName: 'setRoot',
        args: [aa.account.address, root],
      }),
    };
    // setRoot moves no token: pass the fee token itself so the paid rail's
    // token check holds (unset means sponsored, which ignores it).
    const feeToken = aa.network.aa?.feeToken;
    const aaReceipt = await sendAaOperation(
      aa,
      [call],
      feeToken ? aa.network.tokens[feeToken].address : zeroAddress,
    );
    if (!aaReceipt.success) {
      throw new Error(
        `Falha ao gravar a lista: ${aaReceipt.receipt.transactionHash}`,
      );
    }
    return;
  }

  const walletClient = await getWalletClient();
  if (!walletClient) throw new Error('Carteira não conectada');
  const [account] = await walletClient.getAddresses();
  if (!account) throw new Error('Conta indisponível');

  const hash = await walletClient.writeContract({
    address,
    abi,
    functionName: 'setRoot',
    args: [account, root],
    account,
    chain: user.network.value,
  });
  const receipt = await client.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') {
    throw new Error(`Falha ao gravar a lista: ${hash}`);
  }
};

export {
  approveTokens,
  addDeposit,
  getAllowListRoot,
  getP2PixAddress,
  setAllowListRoot,
};

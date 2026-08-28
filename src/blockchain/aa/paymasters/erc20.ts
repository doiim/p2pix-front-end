import { erc20Abi, type Address, type Hex, type PublicClient } from 'viem';
import { type UserOperation } from 'viem/account-abstraction';

import type { AaCall, AaContext } from '../types';
import { TokenEnum } from '@/model/NetworkEnum';

/**
 * The account holds fee token, but not enough for this operation. Callers can
 * still fall back to the sponsorship policy — the operation never left.
 */
export class InsufficientFeeTokenBalanceError extends Error {
  constructor(required: bigint, available: bigint) {
    super(
      `insufficient real ERC-20 balance: required ${required}, available ${available}`,
    );
    this.name = 'InsufficientFeeTokenBalanceError';
  }
}

export type PreparedErc20Quote = {
  token: Address;
  costInToken: bigint;
  chainId: number;
  sender: Address;
  userOperation: UserOperation<'0.7'>;
};

/** Pimlico's ERC-20 fee token is the very token the P2Pix deployment trades. */
const paidTokenFor = (context: AaContext): Address =>
  context.network.tokens[TokenEnum.BRZ].address;

/** Verify the configured token against Pimlico before creating a PIX lock. */
export const assertErc20PaymasterTokenSupported = async (
  context: AaContext,
  applicationToken: Address,
): Promise<Address> => {
  const token = paidTokenFor(context);
  if (token.toLowerCase() !== applicationToken.toLowerCase()) {
    throw new Error('P2Pix token differs from the configured paymaster token');
  }
  const quotes = await context.pimlicoClient.getTokenQuotes({
    chain: context.network,
    tokens: [token],
  });
  if (
    !quotes.some((quote) => quote.token.toLowerCase() === token.toLowerCase())
  ) {
    throw new Error(
      'Configured ERC-20 paymaster token is not supported by Pimlico',
    );
  }
  return token;
};

/**
 * Prepare one exact ERC-20-paymaster UserOperation and bind the displayed
 * maximum cost to it.
 */
export const prepareErc20PaymasterQuote = async (
  context: AaContext,
  calls: readonly AaCall[],
  /** Already-read fee token balance, to skip a duplicate `balanceOf` call. */
  knownTokenBalance?: bigint,
): Promise<PreparedErc20Quote> => {
  const token = paidTokenFor(context);

  let realTokenBalance: bigint;
  let operation: UserOperation<'0.7'>;
  let cost: { costInToken: bigint };
  try {
    const erc20Client = context.erc20Client;
    const publicClient = context.account.client as PublicClient;
    const readBalance = async (): Promise<bigint> =>
      knownTokenBalance ??
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [context.account.address],
      });
    const [userOperation, balance] = await Promise.all([
      erc20Client.prepareUserOperation({
        account: context.account,
        calls,
      }),
      readBalance(),
    ]);
    realTokenBalance = balance;
    operation = userOperation as UserOperation<'0.7'>;
    cost = await context.pimlicoClient.estimateErc20PaymasterCost({
      chain: context.network,
      userOperation: operation,
      token,
    });
  } catch (error) {
    throw new Error(
      `ERC-20 paymaster quote unavailable: ${error instanceof Error ? error.message : 'unknown error'}`,
      { cause: error },
    );
  }

  if (realTokenBalance < cost.costInToken) {
    throw new InsufficientFeeTokenBalanceError(
      cost.costInToken,
      realTokenBalance,
    );
  }

  return {
    token,
    costInToken: cost.costInToken,
    chainId: context.network.id,
    sender: context.account.address,
    userOperation: operation,
  };
};

/**
 * Sign and broadcast the exact operation that was quoted. The Pimlico client
 * has no account attached, so viem does not call prepareUserOperation again.
 */
export const sendPreparedErc20UserOperation = async (
  context: AaContext,
  quote: PreparedErc20Quote,
): Promise<Hex> => {
  if (quote.chainId !== context.network.id) {
    throw new Error('ERC-20 quote chain changed before submission');
  }
  if (quote.sender.toLowerCase() !== context.account.address.toLowerCase()) {
    throw new Error('ERC-20 quote sender changed before submission');
  }

  const signature = await context.account.signUserOperation(
    quote.userOperation,
  );
  return context.pimlicoClient.sendUserOperation({
    ...quote.userOperation,
    signature,
    entryPointAddress: context.account.entryPoint.address,
  });
};

import {
  erc20Abi,
  formatUnits,
  keccak256,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';
import {
  getUserOperationHash,
  type UserOperation,
} from 'viem/account-abstraction';

import type { AaContext } from './aaAccount';
import { getErrorMessage } from '@/utils/error';

export type Erc20FeeEstimate = {
  token: Address;
  costInToken: bigint;
  costInUsd: bigint;
  tokenDecimals: number;
  formattedToken: string;
  formattedUsd: string;
};

export type PreparedErc20Quote = Erc20FeeEstimate & {
  quoteId: Hex;
  calldataHash: Hex;
  chainId: number;
  sender: Address;
  expiresAt: number;
  maxAcceptedTokenCost: bigint;
  realTokenBalance: bigint;
  userOperation: UserOperation<'0.7'>;
};

type AaCall = { to: Address; data: Hex; value?: bigint };

export type Erc20BalanceMode =
  | { type: 'existing' }
  | { type: 'incoming'; token: Address; amount: bigint };

const QUOTE_VALIDITY_MS = 60_000;
const RELEASE_HEADROOM_BPS = 500n;
const BPS_DENOMINATOR = 10_000n;

export const formatErc20Fee = (
  token: Address,
  costInToken: bigint,
  costInUsd: bigint,
  tokenDecimals: number,
): Erc20FeeEstimate => ({
  token,
  costInToken,
  costInUsd,
  tokenDecimals,
  formattedToken: formatUnits(costInToken, tokenDecimals),
  // Pimlico returns USD cost with six decimals.
  formattedUsd: formatUnits(costInUsd, 6),
});

const paidTokenFor = (context: AaContext): Address => {
  const token = context.network.aa?.paymasterPolicies.paidOperations?.token;
  if (!token) throw new Error('ERC-20 paid-operation policy is not configured');
  return token;
};

/** Verify the configured token against Pimlico before creating a PIX lock. */
export const assertErc20PaymasterTokenSupported = async (
  context: AaContext,
  applicationToken: Address,
): Promise<Address> => {
  const token = paidTokenFor(context);
  if (token.toLowerCase() !== applicationToken.toLowerCase()) {
    throw new Error('P2Pix token differs from the configured paymaster token');
  }
  if (!context.pimlicoClient) {
    throw new Error('Pimlico client not available for ERC-20 paymaster');
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

const assertQuoteContext = (
  context: AaContext,
  quote: PreparedErc20Quote,
): void => {
  if (quote.chainId !== context.network.id) {
    throw new Error('ERC-20 quote chain changed before submission');
  }
  if (quote.sender.toLowerCase() !== context.account.address.toLowerCase()) {
    throw new Error('ERC-20 quote sender changed before submission');
  }
  if (quote.expiresAt <= Date.now()) {
    throw new Error(
      'ERC-20 paymaster quote expired; prepare and confirm again',
    );
  }
  if (keccak256(quote.userOperation.callData) !== quote.calldataHash) {
    throw new Error('ERC-20 quote calldata changed before submission');
  }

  const currentQuoteId = getUserOperationHash({
    chainId: quote.chainId,
    entryPointAddress: context.account.entryPoint.address,
    entryPointVersion: '0.7',
    userOperation: quote.userOperation,
  });
  if (currentQuoteId !== quote.quoteId) {
    throw new Error('ERC-20 quoted UserOperation changed before submission');
  }
};

/**
 * Prepare one exact ERC-20-paymaster UserOperation and bind the displayed
 * maximum cost to it. `incoming` is only valid when that same operation
 * transfers the paymaster token to the smart account before postOp.
 */
export const prepareErc20PaymasterQuote = async (
  context: AaContext,
  calls: readonly AaCall[],
  balanceMode: Erc20BalanceMode,
): Promise<PreparedErc20Quote> => {
  const token = paidTokenFor(context);
  if (!context.pimlicoClient) {
    throw new Error('Pimlico client not available for ERC-20 paymaster');
  }

  try {
    if (
      balanceMode.type === 'incoming' &&
      balanceMode.token.toLowerCase() !== token.toLowerCase()
    ) {
      throw new Error(
        'released token differs from the configured paymaster token',
      );
    }

    const erc20Client =
      balanceMode.type === 'incoming'
        ? context.erc20IncomingClient
        : context.erc20Client;
    const publicClient = context.account.client as PublicClient;
    const [userOperation, tokenDecimals, realTokenBalance] = await Promise.all([
      erc20Client.prepareUserOperation({
        account: context.account,
        calls,
      }),
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: token,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [context.account.address],
      }),
    ]);
    const operation = userOperation as UserOperation<'0.7'>;
    const cost = await context.pimlicoClient.estimateErc20PaymasterCost({
      chain: context.network,
      userOperation: operation,
      token,
    });

    if (balanceMode.type === 'existing') {
      if (realTokenBalance < cost.costInToken) {
        throw new Error(
          `insufficient real ERC-20 balance: required ${cost.costInToken}, available ${realTokenBalance}`,
        );
      }
    } else {
      const requiredWithHeadroom =
        cost.costInToken +
        (cost.costInToken * RELEASE_HEADROOM_BPS) / BPS_DENOMINATOR;
      if (balanceMode.amount <= requiredWithHeadroom) {
        throw new Error(
          `released amount does not cover the maximum paymaster cost with safety margin: required more than ${requiredWithHeadroom}, release provides ${balanceMode.amount}`,
        );
      }
    }

    const quoteId = getUserOperationHash({
      chainId: context.network.id,
      entryPointAddress: context.account.entryPoint.address,
      entryPointVersion: '0.7',
      userOperation: operation,
    });
    const fee = formatErc20Fee(
      token,
      cost.costInToken,
      cost.costInUsd,
      tokenDecimals,
    );

    return {
      ...fee,
      quoteId,
      calldataHash: keccak256(operation.callData),
      chainId: context.network.id,
      sender: context.account.address,
      expiresAt: Date.now() + QUOTE_VALIDITY_MS,
      maxAcceptedTokenCost: cost.costInToken,
      realTokenBalance,
      userOperation: operation,
    };
  } catch (error) {
    throw new Error(
      `ERC-20 paymaster quote unavailable: ${getErrorMessage(error, 'unknown error')}`,
      {
        cause: error,
      },
    );
  }
};

/**
 * Sign and broadcast the exact operation that was quoted. The Pimlico client
 * has no account attached, so viem does not call prepareUserOperation again.
 */
export const sendPreparedErc20UserOperation = async (
  context: AaContext,
  quote: PreparedErc20Quote,
): Promise<Hex> => {
  if (!context.pimlicoClient) {
    throw new Error('Pimlico client not available for ERC-20 paymaster');
  }
  assertQuoteContext(context, quote);

  const signature = await context.account.signUserOperation(
    quote.userOperation,
  );
  // A passkey/embedded-wallet prompt can outlive the local quote window.
  assertQuoteContext(context, quote);
  return context.pimlicoClient.sendUserOperation({
    ...quote.userOperation,
    signature,
    entryPointAddress: context.account.entryPoint.address,
  });
};

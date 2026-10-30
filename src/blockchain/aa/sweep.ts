import {
  encodeFunctionData,
  formatEther,
  erc20Abi,
  isAddress,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
} from 'viem';

import type { UserOperation } from 'viem/account-abstraction';

import type { NetworkConfig, TokenEnum } from '@/model/NetworkEnum';
import type { AaCall, AaContext } from './types';

const FEE_HEADROOM_BPS = 2_000n;
const BPS_DENOMINATOR = 10_000n;

const tokenTransfer = (
  token: Address,
  recipient: Address,
  amount: bigint,
): AaCall => ({
  to: token,
  value: 0n,
  data: encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [recipient, amount],
  }),
});

/** One declared token in the account, named by its key in `network.tokens`. */
export type SweepTokenBalance = {
  symbol: TokenEnum;
  address: Address;
  balance: bigint;
  /** Display only; unknown when the token's `decimals()` read fails. */
  decimals?: number;
};

/**
 * Native balance plus every token the network declares, each read with its
 * own decimals: the sweep moves all of them. A token whose balance read fails
 * is left out, so one broken token cannot block the rest, and listed in
 * `skipped`; a failed `decimals()` only affects how the balance is shown.
 */
export const readSweepBalances = async (context: AaContext) => {
  const publicClient = context.account.client as PublicClient;
  const owner = context.account.address;
  const declared = Object.entries(context.network.tokens) as [
    TokenEnum,
    { address: Address },
  ][];
  const [eth, settled] = await Promise.all([
    publicClient.getBalance({ address: owner }),
    Promise.allSettled(
      declared.map(async ([symbol, { address }]) => {
        const [balance, decimals] = await Promise.all([
          publicClient.readContract({
            address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner],
          }),
          publicClient
            .readContract({ address, abi: erc20Abi, functionName: 'decimals' })
            .catch(() => undefined),
        ]);
        return { symbol, address, balance, decimals };
      }),
    ),
  ]);
  const tokens: SweepTokenBalance[] = [];
  const skipped: TokenEnum[] = [];
  settled.forEach((result, i) => {
    if (result.status === 'fulfilled') return void tokens.push(result.value);
    skipped.push(declared[i][0]);
    console.error(`[sweep] skipping ${declared[i][0]}`, result.reason);
  });
  return { eth, tokens, skipped };
};

/** Whether P2Pix sponsors the sweep gas on this network (else the account pays in ETH). */
const isSweepSponsored = (network: NetworkConfig): boolean =>
  network.aa?.sponsorSweep === true;

/** pt-BR note on who pays the sweep gas on this network. */
export const sweepGasNote = (network: NetworkConfig): string =>
  isSweepSponsored(network)
    ? 'Gas pago pelo P2Pix.'
    : 'Gas pago com ETH da própria conta: uma parte do ETH fica reservada para a taxa.';

const sweepCalls = (
  recipient: Address,
  eth: bigint,
  tokens: readonly SweepTokenBalance[],
): AaCall[] => [
  ...tokens
    .filter((token) => token.balance > 0n)
    .map((token) => tokenTransfer(token.address, recipient, token.balance)),
  ...(eth > 0n ? [{ to: recipient, value: eth, data: '0x' as const }] : []),
];

/** Gas the account must hold up front: the UserOp's worst-case cost, plus headroom. */
const gasReserve = (op: UserOperation<'0.7'>): bigint => {
  const gas =
    op.callGasLimit +
    op.verificationGasLimit +
    op.preVerificationGas +
    (op.paymasterVerificationGasLimit ?? 0n) +
    (op.paymasterPostOpGasLimit ?? 0n);
  const cost = gas * op.maxFeePerGas;
  return cost + (cost * FEE_HEADROOM_BPS) / BPS_DENOMINATOR;
};

/**
 * Move all ETH and every declared token of the context's account to
 * `recipient` in one UserOperation. Gas is paid by P2Pix (`aa.sponsorSweep`),
 * else by the account in ETH, keeping back the estimated cost.
 */
export const sweepAccount = async (
  context: AaContext,
  recipient: Address,
): Promise<{ userOpHash: Hex }> => {
  const { eth, tokens, skipped } = await readSweepBalances(context);
  if (eth === 0n && tokens.every((token) => token.balance === 0n)) {
    throw new Error(
      skipped.length > 0
        ? `Não foi possível ler o saldo de ${skipped.join(', ')}`
        : 'Não há saldo para varrer',
    );
  }

  const sponsored = isSweepSponsored(context.network);
  const client = sponsored ? context.sponsoredClient : context.selfPayClient;
  const operation = sponsored
    ? { calls: sweepCalls(recipient, eth, tokens) }
    : await selfPayOperation(context, recipient, eth, tokens);

  const userOpHash = await client.sendUserOperation(operation);
  const receipt = await client.waitForUserOperationReceipt({
    hash: userOpHash,
  });
  if (!receipt.success) throw new Error(`Falha na varredura: ${userOpHash}`);
  return { userOpHash };
};

/**
 * Estimate the full sweep without a paymaster (the account's stub signature
 * covers the backup passkey's on-chain P-256 verification) and leave the
 * reserve behind in ETH. The send keeps the probe's fees: a re-estimate at a
 * higher price could exceed the reserve.
 */
const selfPayOperation = async (
  context: AaContext,
  recipient: Address,
  eth: bigint,
  tokens: readonly SweepTokenBalance[],
) => {
  // Probe with 1 wei: moving the whole balance leaves nothing for the prefund
  // and reverts in simulation; 1 wei keeps the value transfer in the estimate.
  const probe = await context.selfPayClient.prepareUserOperation({
    account: context.account,
    calls: sweepCalls(recipient, eth > 0n ? 1n : 0n, tokens),
  });
  const reserve = gasReserve(probe);
  if (eth <= reserve) {
    throw new Error(
      `Saldo de ETH insuficiente para o gás: a conta precisa de pelo menos ${formatEther(reserve)} ETH.`,
    );
  }
  return {
    calls: sweepCalls(recipient, eth - reserve, tokens),
    maxFeePerGas: probe.maxFeePerGas,
    maxPriorityFeePerGas: probe.maxPriorityFeePerGas,
  };
};

/** Error message for an unusable sweep destination, or null when it is fine. */
export const validateSweepRecipient = (
  recipient: string,
  ownAddress?: string | null,
): string | null => {
  if (!isAddress(recipient)) return 'Informe um endereço de destino válido.';
  const lower = recipient.toLowerCase();
  if (lower === zeroAddress) {
    return 'O endereço de destino não pode ser o endereço zero.';
  }
  if (ownAddress?.toLowerCase() === lower) {
    return 'O endereço de destino não pode ser a própria conta.';
  }
  return null;
};

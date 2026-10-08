import {
  BaseError,
  ContractFunctionRevertedError,
  encodeErrorResult,
  getAddress,
  zeroAddress,
} from 'viem';
import type { PublicClient } from 'viem';
import { p2PixAbi, reputationAbi } from './abi';
import {
  LOCKAMOUNT_UPPERBOUND_TOKENS,
  castAddrToKey,
  creditTokensFromWei,
  effectiveLimit,
  limiterReplica,
} from '@/utils/reputation';
import type {
  ReputationErrorKind,
  ReputationSnapshot,
  ReputationTarget,
} from '@/utils/reputation';

export class ReputationReadError extends Error {
  readonly kind: ReputationErrorKind;

  constructor(kind: ReputationErrorKind, options?: ErrorOptions) {
    super(`Reputation read failed (${kind})`, options);
    this.name = 'ReputationReadError';
    this.kind = kind;
  }
}

/** Reads one snapshot (D1) pinned to a single block, at or above `minBlock`. Throws ReputationReadError ('rpc' | 'module'); never returns invented values. */
export const readReputationSnapshot = async (
  client: PublicClient,
  target: ReputationTarget,
  opts: { minBlock?: bigint } = {},
): Promise<ReputationSnapshot> => {
  // The selected network can change between building the target and fetching the client.
  if (client.chain?.id !== target.chainId)
    throw new ReputationReadError('rpc', {
      cause: new Error(
        `client chain ${client.chain?.id} differs from target chain ${target.chainId}`,
      ),
    });
  const p2pix = getAddress(target.p2pix);
  const account = getAddress(target.account);
  const key = castAddrToKey(account);
  const blockNumber = await headAtLeast(
    client,
    opts.minBlock ?? 0n,
    Date.now() + MIN_BLOCK_WAIT_MS,
  );

  const [creditWei, reputation] = await client
    .multicall({
      allowFailure: false,
      blockNumber,
      contracts: [
        {
          address: p2pix,
          abi: p2PixAbi,
          functionName: 'userRecord',
          args: [key],
        },
        { address: p2pix, abi: p2PixAbi, functionName: 'reputation' },
      ],
    })
    .catch(rpcFailure);
  if (reputation === zeroAddress)
    throw new ReputationReadError('module', {
      cause: new Error('P2PIX.reputation() is the zero address'),
    });
  const creditTokens = creditTokensFromWei(creditWei);

  const limiterCall = (credit: bigint) => ({
    address: reputation,
    abi: reputationAbi,
    functionName: 'limiter' as const,
    args: [credit] as const,
  });
  // A plain array, not a tuple: viem cannot type a tuple with an array spread into it. Every call
  // here returns uint256, so the reads stay typed.
  const moduleCalls = [
    limiterCall(creditTokens),
    limiterCall(0n),
    {
      address: reputation,
      abi: reputationAbi,
      functionName: 'maxLimit' as const,
    },
    {
      address: reputation,
      abi: reputationAbi,
      functionName: 'magicValue' as const,
    },
    ...CURVE_PROBE_CREDITS.map(limiterCall),
  ];
  const moduleReads = await client
    .multicall({ allowFailure: true, blockNumber, contracts: moduleCalls })
    .catch(rpcFailure);
  const [limiterRead, baseRead, maxLimitRead, magicValueRead, ...probeReads] =
    moduleReads;
  // viem hands every call the same error object when the aggregate call itself failed (transport);
  // a call that reverted or returned no data gets its own, which points at the module.
  if (limiterRead.status === 'failure' || baseRead.status === 'failure')
    throw new ReputationReadError(
      moduleReads.every(
        (read) =>
          read.status === 'failure' && read.error === moduleReads[0].error,
      )
        ? 'rpc'
        : 'module',
      { cause: limiterRead.error ?? baseRead.error },
    );
  const limiterValue = limiterRead.result;
  const baseValue = baseRead.result;
  const limitTokens = effectiveLimit(limiterValue);

  const nextLimiterValue =
    limitTokens < LOCKAMOUNT_UPPERBOUND_TOKENS
      ? await client
          .multicall({
            allowFailure: true,
            blockNumber,
            contracts: [limiterCall(creditTokens + limitTokens)],
          })
          .then(([next]) => {
            if (next.status === 'success') return next.result;
            console.error('[reputation] next-limit read failed', next.error);
            return null;
          })
          .catch(rpcFailure)
      : null;

  const curve =
    maxLimitRead.status === 'success' &&
    magicValueRead.status === 'success' &&
    maxLimitRead.result > 0n
      ? {
          base: baseValue,
          maxLimit: maxLimitRead.result,
          magicValue: magicValueRead.result,
        }
      : null;
  // Every limiter value read at this block; the replica must reproduce all of them (D8). A probe
  // that reverted (null) must be one the replica cannot compute either.
  const limiterReads = [
    { credit: 0n, value: baseValue },
    { credit: creditTokens, value: limiterValue },
    ...(nextLimiterValue === null
      ? []
      : [{ credit: creditTokens + limitTokens, value: nextLimiterValue }]),
    ...CURVE_PROBE_CREDITS.map((credit, i) => ({
      credit,
      value: probeReads[i].status === 'success' ? probeReads[i].result : null,
    })),
  ];

  return {
    chainId: target.chainId,
    p2pix,
    account,
    blockNumber,
    key,
    reputation,
    creditTokens,
    limiterValue,
    limitTokens,
    baseValue,
    newWalletLimitTokens: effectiveLimit(baseValue),
    nextLimitTokens:
      nextLimiterValue === null ? null : effectiveLimit(nextLimiterValue),
    curve:
      curve !== null &&
      limiterReads.every(
        (read) => limiterReplica(curve, read.credit) === read.value,
      )
        ? curve
        : null,
  };
};

/** True only for P2Pix `AmountNotAllowed()` revert data anywhere in the cause chain (D6). */
export const isAmountNotAllowedError = (err: unknown): boolean =>
  causeChain(err, MAX_CAUSE_DEPTH)
    .flatMap(revertDataCandidates)
    .some((hex) => hex.toLowerCase() === AMOUNT_NOT_ALLOWED_SELECTOR);

// Fixed credits (10 to 10^9 tokens) at which the module must match the replica before the chart may
// plot it: the user's own credit points alone leave most of the plotted range unchecked. They do
// not depend on the user or the typed amount.
const CURVE_PROBE_CREDITS = Array.from(
  { length: 9 },
  (_, i) => 10n ** BigInt(i + 1),
);

const rpcFailure = (cause: unknown): never => {
  throw new ReputationReadError('rpc', { cause });
};

// The receipt behind minBlock can come from another node (the bundler on the AA rail). Nodes reject
// eth_call at a block they have not seen, so poll this one until it gets there, within a bound.
const MIN_BLOCK_WAIT_MS = 30_000;

const headAtLeast = async (
  client: PublicClient,
  minBlock: bigint,
  deadline: number,
): Promise<bigint> => {
  const latest = await client
    .getBlockNumber({ cacheTime: 0 })
    .catch(rpcFailure);
  if (latest >= minBlock) return latest;
  if (Date.now() + client.pollingInterval > deadline)
    throw new ReputationReadError('rpc', {
      cause: new Error(`node is at block ${latest}, below ${minBlock}`),
    });
  await new Promise((resolve) => setTimeout(resolve, client.pollingInterval));
  return headAtLeast(client, minBlock, deadline);
};

// AmountNotAllowed() has no arguments, so its revert data is exactly the 4-byte selector (0x1c18f846).
const AMOUNT_NOT_ALLOWED_SELECTOR = encodeErrorResult({
  abi: p2PixAbi,
  errorName: 'AmountNotAllowed',
});
const MAX_CAUSE_DEPTH = 10;
const HEX_PATTERN = /0x[0-9a-fA-F]+/g;

const causeChain = (err: unknown, depth: number): object[] =>
  depth === 0 || typeof err !== 'object' || err === null
    ? []
    : [err, ...causeChain('cause' in err ? err.cause : undefined, depth - 1)];

// EOA rail: ContractFunctionRevertedError.raw. AA rail: the bundler's ExecutionRevertedError
// carries data.revertData, or the revert is only in the text of the raw JSON-RPC error object
// (`{code: -32521, message: '… reason: 0x…'}`, a plain object at the end of the chain); the ERC-20
// paymaster quote rethrows as a plain Error (message text). A viem BaseError's message is skipped:
// it repeats request details, not revert data.
const revertDataCandidates = (err: object): string[] => [
  ...(err instanceof ContractFunctionRevertedError && err.raw !== undefined
    ? [err.raw]
    : []),
  ...('data' in err ? dataCandidates(err.data) : []),
  ...(!(err instanceof BaseError) &&
  'message' in err &&
  typeof err.message === 'string'
    ? (err.message.match(HEX_PATTERN) ?? [])
    : []),
];

const dataCandidates = (data: unknown): string[] => {
  if (typeof data === 'string') return [data];
  return typeof data === 'object' &&
    data !== null &&
    'revertData' in data &&
    typeof data.revertData === 'string'
    ? [data.revertData]
    : [];
};

import {
  BaseError,
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  RpcRequestError,
  UserRejectedRequestError,
  createPublicClient,
  custom,
  encodeErrorResult,
} from 'viem';
import type { Address, Hex } from 'viem';
import { getUserOperationError } from 'viem/account-abstraction';
import { sepolia } from 'viem/chains';
import { describe, expect, it } from 'vitest';
import { p2PixAbi } from '@/blockchain/abi';
import { isAmountNotAllowedError } from '@/blockchain/reputation';

const P2PIX: Address = '0xb9de24ab263c812a080488edab0382701c754bbc';
const SELLER: Address = '0x00000000000000000000000000000000000000a1';
const TOKEN: Address = '0x00000000000000000000000000000000000000b2';
const KERNEL: Address = '0x00000000000000000000000000000000000000c3';

const LOCK_ARGS = [SELLER, TOKEN, 1_000n * 10n ** 18n, [], []] as const;

const AMOUNT_NOT_ALLOWED: Hex = '0x1c18f846';
const NOT_ENOUGH_TOKENS: Hex = '0x22bbb43c';
const STATIC_CALL_FAILED: Hex = '0xe10bf1cc';
const INVALID_DEPOSIT = encodeErrorResult({
  abi: p2PixAbi,
  errorName: 'InvalidDeposit',
});

// EOA rail: buyerMethods simulates lock() before signing; the node answers with the revert data.
const simulateLockError = async (revertData: Hex): Promise<unknown> => {
  const client = createPublicClient({
    chain: sepolia,
    transport: custom(
      {
        request: async () => {
          throw new RpcRequestError({
            body: { method: 'eth_call' },
            url: 'https://rpc.invalid',
            error: { code: 3, message: 'execution reverted', data: revertData },
          });
        },
      },
      { retryCount: 0 },
    ),
  });
  return client
    .simulateContract({
      address: P2PIX,
      abi: p2PixAbi,
      functionName: 'lock',
      args: LOCK_ARGS,
      account: KERNEL,
    })
    .then(
      () => null,
      (err: unknown) => err,
    );
};

// AA rail: the bundler rejects gas estimation with -32521; the calls carry no ABI (AaCall), so
// viem leaves an ExecutionRevertedError with data.revertData under UserOperationExecutionError.
const bundlerError = (revertData: Hex) =>
  bundlerRpcError({
    code: -32521,
    message: 'execution reverted',
    data: { revertData },
  });

// Some bundlers put the revert only in the message text, with no data (viem's own fixture shape).
const bundlerTextError = (code: number, revertData: Hex) =>
  bundlerRpcError({
    code,
    message: `UserOperation reverted during simulation with reason: ${revertData}`,
  });

const bundlerRpcError = (error: {
  code: number;
  message: string;
  data?: { revertData: Hex };
}) =>
  getUserOperationError(
    new RpcRequestError({
      body: { method: 'eth_estimateUserOperationGas' },
      url: 'https://bundler.invalid',
      error,
    }),
    {
      callData: '0x',
      callGasLimit: 0n,
      maxFeePerGas: 0n,
      maxPriorityFeePerGas: 0n,
      nonce: 0n,
      preVerificationGas: 0n,
      sender: KERNEL,
      signature: '0x',
      verificationGasLimit: 0n,
      calls: [{ to: P2PIX, data: '0x', value: 0n }],
    },
  );

// src/blockchain/aa/paymasters/erc20.ts wraps quote failures in a plain Error.
const paymasterQuoteError = (cause: Error) =>
  new Error(`ERC-20 paymaster quote unavailable: ${cause.message}`, { cause });

const wrapped = (depth: number, inner: Error): Error =>
  depth === 0
    ? inner
    : wrapped(depth - 1, new Error('wrapper', { cause: inner }));

describe('isAmountNotAllowedError', () => {
  it('is AmountNotAllowed() with no arguments: exactly the selector', () => {
    expect(
      encodeErrorResult({ abi: p2PixAbi, errorName: 'AmountNotAllowed' }),
    ).toBe(AMOUNT_NOT_ALLOWED);
  });

  describe('recognises the refusal', () => {
    it('from a simulated lock() on the EOA rail', async () => {
      const err = await simulateLockError(AMOUNT_NOT_ALLOWED);
      expect(err).toBeInstanceOf(ContractFunctionExecutionError);
      expect(isAmountNotAllowedError(err)).toBe(true);
    });

    it('from a hand-built ContractFunctionRevertedError', () => {
      const reverted = new ContractFunctionRevertedError({
        abi: p2PixAbi,
        data: AMOUNT_NOT_ALLOWED,
        functionName: 'lock',
      });
      expect(
        isAmountNotAllowedError(
          new ContractFunctionExecutionError(reverted, {
            abi: p2PixAbi,
            functionName: 'lock',
            args: LOCK_ARGS,
          }),
        ),
      ).toBe(true);
    });

    it('from bundler gas estimation on the AA rail', () => {
      const err = bundlerError(AMOUNT_NOT_ALLOWED);
      expect(err.name).toBe('UserOperationExecutionError');
      expect(err.cause).toMatchObject({
        name: 'ExecutionRevertedError',
        data: { revertData: AMOUNT_NOT_ALLOWED },
      });
      expect(isAmountNotAllowedError(err)).toBe(true);
    });

    it.each([-32521, -32500])(
      'from a bundler %i error that carries the revert only in its message',
      (code) => {
        const err = bundlerTextError(code, AMOUNT_NOT_ALLOWED);
        expect(err.name).toBe('UserOperationExecutionError');
        expect(isAmountNotAllowedError(err)).toBe(true);
      },
    );

    it('through the ERC-20 paymaster quote wrapper', () => {
      expect(
        isAmountNotAllowedError(
          paymasterQuoteError(bundlerError(AMOUNT_NOT_ALLOWED)),
        ),
      ).toBe(true);
    });

    it('in the message of a plain Error, in any case', () => {
      expect(
        isAmountNotAllowedError(
          new Error('ERC-20 paymaster quote unavailable: reverted 0x1c18f846'),
        ),
      ).toBe(true);
      expect(isAmountNotAllowedError(new Error('reverted: 0x1C18F846'))).toBe(
        true,
      );
    });

    it('in a raw RPC error carrying the data string', () => {
      expect(
        isAmountNotAllowedError(
          new RpcRequestError({
            body: {},
            url: 'https://rpc.invalid',
            error: {
              code: 3,
              message: 'execution reverted',
              data: AMOUNT_NOT_ALLOWED,
            },
          }),
        ),
      ).toBe(true);
    });

    it('up to ten levels down the cause chain', () => {
      const inner = new Error(`reverted ${AMOUNT_NOT_ALLOWED}`);
      expect(isAmountNotAllowedError(wrapped(9, inner))).toBe(true);
      expect(isAmountNotAllowedError(wrapped(10, inner))).toBe(false);
    });
  });

  describe('leaves every other failure alone', () => {
    it.each([
      ['NotEnoughTokens', NOT_ENOUGH_TOKENS],
      ['InvalidDeposit', INVALID_DEPOSIT],
      ['StaticCallFailed', STATIC_CALL_FAILED],
    ])('%s on the EOA rail', async (_, data) => {
      expect(isAmountNotAllowedError(await simulateLockError(data))).toBe(
        false,
      );
    });

    it.each([
      ['NotEnoughTokens', NOT_ENOUGH_TOKENS],
      ['InvalidDeposit', INVALID_DEPOSIT],
      ['StaticCallFailed', STATIC_CALL_FAILED],
    ])('%s on the AA rail', (_, data) => {
      expect(isAmountNotAllowedError(bundlerError(data))).toBe(false);
      expect(isAmountNotAllowedError(bundlerTextError(-32521, data))).toBe(
        false,
      );
      expect(
        isAmountNotAllowedError(paymasterQuoteError(bundlerError(data))),
      ).toBe(false);
    });

    it('hex that merely starts with the selector', () => {
      expect(
        isAmountNotAllowedError(
          new Error('to 0x1c18f8460000000000000000000000000000abcd'),
        ),
      ).toBe(false);
      expect(
        isAmountNotAllowedError(
          new Error(`Transaction failed: 0x1c18f846${'ab'.repeat(28)}`),
        ),
      ).toBe(false);
    });

    it('a failed transaction hash, a user rejection or a wallet error', () => {
      expect(
        isAmountNotAllowedError(
          new Error(`Transaction failed: 0x${'12'.repeat(32)}`),
        ),
      ).toBe(false);
      expect(
        isAmountNotAllowedError(new UserRejectedRequestError(new Error('no'))),
      ).toBe(false);
      expect(isAmountNotAllowedError(new Error('Wallet not connected'))).toBe(
        false,
      );
    });

    it("text inside a viem BaseError's message, which carries no revert data", () => {
      expect(
        isAmountNotAllowedError(
          new BaseError(`mentions ${AMOUNT_NOT_ALLOWED}`),
        ),
      ).toBe(false);
    });

    it('values that are not errors', () => {
      [AMOUNT_NOT_ALLOWED, 'string', null, undefined, 42, {}].forEach((value) =>
        expect(isAmountNotAllowedError(value)).toBe(false),
      );
    });

    it('a cause chain that loops back on itself', () => {
      const looping = new Error('outer');
      looping.cause = looping;
      expect(isAmountNotAllowedError(looping)).toBe(false);
    });
  });
});

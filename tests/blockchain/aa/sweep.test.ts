import { describe, expect, it, vi } from 'vitest';
import { decodeFunctionData, erc20Abi, type Address } from 'viem';
import { sweepAccount, validateSweepRecipient } from '@/blockchain/aa/sweep';
import type { AaContext } from '@/blockchain/aa/types';

const ACCOUNT: Address = '0x1111111111111111111111111111111111111111';
const RECIPIENT: Address = '0x2222222222222222222222222222222222222222';
const BRZ: Address = '0x3333333333333333333333333333333333333333';
const USDC: Address = '0x4444444444444444444444444444444444444444';

type Call = { to: Address; value: bigint; data: `0x${string}` };

// The RPC and bundler are the boundary: balances and gas quotes are what the
// chain would answer, everything else runs the real sweep code.
const fakeContext = ({
  eth,
  balances,
  sponsorSweep,
}: {
  eth: bigint;
  balances: Record<Address, bigint | Error>;
  sponsorSweep: boolean;
}) => {
  const readContract = vi.fn(
    async ({
      address,
      functionName,
    }: {
      address: Address;
      functionName: string;
    }) => {
      if (functionName === 'decimals') return 18;
      const balance = balances[address];
      if (balance instanceof Error) throw balance;
      return balance;
    },
  );
  const bundler = () => ({
    sendUserOperation: vi.fn().mockResolvedValue('0xhash'),
    waitForUserOperationReceipt: vi.fn().mockResolvedValue({ success: true }),
    prepareUserOperation: vi.fn().mockResolvedValue({
      callGasLimit: 100n,
      verificationGasLimit: 200n,
      preVerificationGas: 50n,
      paymasterVerificationGasLimit: undefined,
      paymasterPostOpGasLimit: undefined,
      maxFeePerGas: 10n,
      maxPriorityFeePerGas: 2n,
    }),
  });
  const context = {
    account: {
      address: ACCOUNT,
      client: { getBalance: vi.fn().mockResolvedValue(eth), readContract },
    },
    network: {
      tokens: { BRZ: { address: BRZ }, USDC: { address: USDC } },
      aa: { sponsorSweep },
    },
    sponsoredClient: bundler(),
    selfPayClient: bundler(),
  };
  return context as typeof context & AaContext;
};

const sentCalls = (client: { sendUserOperation: ReturnType<typeof vi.fn> }) =>
  client.sendUserOperation.mock.calls[0][0].calls as Call[];

const transferOf = (call: Call) =>
  decodeFunctionData({ abi: erc20Abi, data: call.data }).args;

describe('validateSweepRecipient', () => {
  it('rejects a malformed address', () => {
    expect(validateSweepRecipient('0x123')).toBe(
      'Informe um endereço de destino válido.',
    );
  });

  it('rejects the zero address', () => {
    expect(
      validateSweepRecipient('0x0000000000000000000000000000000000000000'),
    ).toBe('O endereço de destino não pode ser o endereço zero.');
  });

  it('rejects the account itself, whatever the case', () => {
    expect(validateSweepRecipient(ACCOUNT, ACCOUNT.toUpperCase())).toBe(
      'O endereço de destino não pode ser a própria conta.',
    );
  });

  it('accepts another address', () => {
    expect(validateSweepRecipient(RECIPIENT, ACCOUNT)).toBeNull();
  });
});

describe('sweepAccount', () => {
  it('sponsored: moves non-zero tokens first, then ETH, in one operation', async () => {
    const context = fakeContext({
      eth: 5n,
      balances: { [BRZ]: 0n, [USDC]: 7n },
      sponsorSweep: true,
    });

    await sweepAccount(context, RECIPIENT);

    const calls = sentCalls(context.sponsoredClient);
    expect(calls).toHaveLength(2);
    expect(calls[0].to).toBe(USDC);
    expect(transferOf(calls[0])).toEqual([RECIPIENT, 7n]);
    expect(calls[1]).toEqual({ to: RECIPIENT, value: 5n, data: '0x' });
    expect(context.selfPayClient.sendUserOperation).not.toHaveBeenCalled();
  });

  it('self-paid: probes with 1 wei and keeps the gas reserve in ETH', async () => {
    const context = fakeContext({
      eth: 10_000n,
      balances: { [BRZ]: 3n, [USDC]: 0n },
      sponsorSweep: false,
    });

    await sweepAccount(context, RECIPIENT);

    const probe = context.selfPayClient.prepareUserOperation.mock.calls[0][0];
    expect(probe.calls.at(-1).value).toBe(1n);
    // (100 + 200 + 50) gas * 10 wei = 3500, plus 20% headroom
    const reserve = 4_200n;
    const operation = context.selfPayClient.sendUserOperation.mock.calls[0][0];
    expect(operation.calls.at(-1).value).toBe(10_000n - reserve);
    expect(transferOf(operation.calls[0])).toEqual([RECIPIENT, 3n]);
    expect(operation.maxFeePerGas).toBe(10n);
    expect(operation.maxPriorityFeePerGas).toBe(2n);
  });

  it('self-paid: refuses when ETH does not cover the reserve', async () => {
    const context = fakeContext({
      eth: 4_200n,
      balances: { [BRZ]: 3n, [USDC]: 0n },
      sponsorSweep: false,
    });

    await expect(sweepAccount(context, RECIPIENT)).rejects.toThrow(
      'Saldo de ETH insuficiente para o gás',
    );
    expect(context.selfPayClient.sendUserOperation).not.toHaveBeenCalled();
  });

  it('refuses an empty account', async () => {
    const context = fakeContext({
      eth: 0n,
      balances: { [BRZ]: 0n, [USDC]: 0n },
      sponsorSweep: true,
    });

    await expect(sweepAccount(context, RECIPIENT)).rejects.toThrow(
      'Não há saldo para varrer',
    );
  });

  it('names the tokens it could not read instead of reporting an empty account', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const context = fakeContext({
      eth: 0n,
      balances: { [BRZ]: new Error('rpc down'), [USDC]: 0n },
      sponsorSweep: true,
    });

    await expect(sweepAccount(context, RECIPIENT)).rejects.toThrow(
      'Não foi possível ler o saldo de BRZ',
    );
  });
});

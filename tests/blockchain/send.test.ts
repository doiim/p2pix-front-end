import { beforeEach, describe, expect, it, vi } from 'vitest';
import { erc20Abi, type Address } from 'viem';

const { getActiveAaContext, sendAaOperation, getContract } = vi.hoisted(() => ({
  getActiveAaContext: vi.fn(),
  sendAaOperation: vi.fn(),
  getContract: vi.fn(),
}));

vi.mock('@/blockchain/aa/operations', () => ({
  getActiveAaContext,
  sendAaOperation,
}));
vi.mock('@/blockchain/provider', () => ({ getContract }));

import { sendContractCalls, type Sender } from '@/blockchain/send';

const ACCOUNT: Address = '0x1111111111111111111111111111111111111111';
const OTHER: Address = '0x2222222222222222222222222222222222222222';
const TOKEN: Address = '0x3333333333333333333333333333333333333333';

const calls = [
  {
    address: TOKEN,
    abi: erc20Abi,
    functionName: 'approve',
    args: [OTHER, 1n],
  },
];

const from = (overrides: Partial<Sender> = {}): Sender => ({
  address: ACCOUNT,
  isSmartAccount: true,
  chainId: 1,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('sendContractCalls on the smart-account rail', () => {
  const aaOn = (chainId: number, address: Address = ACCOUNT) =>
    getActiveAaContext.mockResolvedValue({
      account: { address },
      network: { id: chainId },
    });

  it('sends when network and account are the ones the calls were built for', async () => {
    aaOn(1);
    sendAaOperation.mockResolvedValue({ success: true, receipt: {}, logs: [] });

    const result = await sendContractCalls(from(), calls);

    expect(result.success).toBe(true);
    expect(sendAaOperation).toHaveBeenCalledOnce();
  });

  it('refuses after a network switch', async () => {
    aaOn(2);

    await expect(sendContractCalls(from(), calls)).rejects.toThrow(
      'A conta ou a rede mudou; tente novamente',
    );
    expect(sendAaOperation).not.toHaveBeenCalled();
  });

  it('refuses after an account switch', async () => {
    aaOn(1, OTHER);

    await expect(sendContractCalls(from(), calls)).rejects.toThrow(
      'A conta ou a rede mudou; tente novamente',
    );
    expect(sendAaOperation).not.toHaveBeenCalled();
  });
});

describe('sendContractCalls on the regular-wallet rail', () => {
  const walletOn = (walletChain: number, clientChain: number) => {
    const wallet = {
      chain: { id: walletChain },
      writeContract: vi.fn().mockResolvedValue('0xhash'),
    };
    getActiveAaContext.mockResolvedValue(null);
    getContract.mockResolvedValue({
      wallet,
      account: ACCOUNT,
      client: {
        chain: { id: clientChain },
        simulateContract: vi.fn().mockResolvedValue({ request: {} }),
        waitForTransactionReceipt: vi
          .fn()
          .mockResolvedValue({ status: 'success', logs: [] }),
      },
    });
    return wallet;
  };

  it('writes when both clients sit on the pinned chain', async () => {
    const wallet = walletOn(1, 1);

    const result = await sendContractCalls(
      from({ isSmartAccount: false }),
      calls,
    );

    expect(result.success).toBe(true);
    expect(wallet.writeContract).toHaveBeenCalledOnce();
  });

  it.each([
    [2, 2],
    [1, 2],
    [2, 1],
  ])(
    'refuses with wallet on %i and reads on %i',
    async (walletChain, clientChain) => {
      const wallet = walletOn(walletChain, clientChain);

      await expect(
        sendContractCalls(from({ isSmartAccount: false }), calls),
      ).rejects.toThrow('A conta ou a rede mudou; tente novamente');
      expect(wallet.writeContract).not.toHaveBeenCalled();
    },
  );
});

import { describe, expect, it, vi } from 'vitest';
import type { Address, Hex } from 'viem';
import {
  entryPoint07Address,
  type UserOperation,
} from 'viem/account-abstraction';

import type { AaContext } from './aaAccount';
import {
  assertErc20PaymasterTokenSupported,
  formatErc20Fee,
  prepareErc20PaymasterQuote,
  sendPreparedErc20UserOperation,
} from './erc20Paymaster';
import { requestFirstLockAuthorization } from '@/utils/bbPay';

const TOKEN = `0x${'1'.repeat(40)}` as Address;
const OTHER_TOKEN = `0x${'2'.repeat(40)}` as Address;
const SENDER = `0x${'3'.repeat(40)}` as Address;
const TARGET = `0x${'4'.repeat(40)}` as Address;
const USER_OP_HASH = `0x${'5'.repeat(64)}` as Hex;
const ORDER = `0x${'6'.repeat(64)}` as Hex;

const operation = (): UserOperation<'0.7'> => ({
  sender: SENDER,
  nonce: 0n,
  callData: '0x1234',
  callGasLimit: 100_000n,
  verificationGasLimit: 200_000n,
  preVerificationGas: 50_000n,
  maxFeePerGas: 2n,
  maxPriorityFeePerGas: 1n,
  signature: '0x',
});

describe('first-lock authorization boundary', () => {
  const request = {
    orderId: ORDER,
    chainId: 1,
    sender: SENDER,
    contractAddress: TARGET,
    seller: `0x${'7'.repeat(40)}` as Address,
    token: TOKEN,
    amount: '1000',
  };

  it('sends authenticated exact-order context and accepts a valid grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        eligible: true,
        orderId: ORDER,
        authorizationId: 'grant-1',
        expiresAtMs: Date.now() + 60_000,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(requestFirstLockAuthorization(request)).resolves.toMatchObject(
      {
        eligible: true,
        authorizationId: 'grant-1',
      },
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/aa/first-lock-authorization'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(request),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('accepts only an authoritative negative decision and throws on boundary failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          eligible: false,
          orderId: ORDER,
          reason: 'already-consumed',
        }),
      }),
    );
    await expect(requestFirstLockAuthorization(request)).resolves.toEqual({
      eligible: false,
      orderId: ORDER,
      reason: 'already-consumed',
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503 }),
    );
    await expect(requestFirstLockAuthorization(request)).rejects.toThrow(
      /HTTP 503/,
    );

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ eligible: false, orderId: ORDER }),
      }),
    );
    await expect(requestFirstLockAuthorization(request)).rejects.toThrow(
      /invalid eligibility decision/,
    );
    vi.unstubAllGlobals();
  });
});

const makeContext = ({ balance = 10_000n, cost = 1_000n } = {}) => {
  const prepared = operation();
  const readContract = vi.fn(async ({ functionName }) => {
    if (functionName === 'decimals') return 6;
    if (functionName === 'balanceOf') return balance;
    throw new Error(`unexpected read ${functionName}`);
  });
  const prepareExistingUserOperation = vi.fn().mockResolvedValue(prepared);
  const prepareIncomingUserOperation = vi.fn().mockResolvedValue(prepared);
  const estimateErc20PaymasterCost = vi.fn().mockResolvedValue({
    costInToken: cost,
    costInUsd: 2_000_000n,
  });
  const sendUserOperation = vi.fn().mockResolvedValue(USER_OP_HASH);
  const getTokenQuotes = vi.fn().mockResolvedValue([{ token: TOKEN }]);
  const signUserOperation = vi.fn().mockResolvedValue('0xabcdef');
  const context = {
    network: {
      id: 1,
      aa: {
        paymasterPolicies: {
          paidOperations: { token: TOKEN },
        },
      },
    },
    account: {
      address: SENDER,
      entryPoint: { address: entryPoint07Address, version: '0.7' },
      client: { readContract },
      signUserOperation,
    },
    erc20Client: { prepareUserOperation: prepareExistingUserOperation },
    erc20IncomingClient: {
      prepareUserOperation: prepareIncomingUserOperation,
    },
    pimlicoClient: {
      estimateErc20PaymasterCost,
      getTokenQuotes,
      sendUserOperation,
    },
  } as unknown as AaContext;

  return {
    context,
    prepared,
    readContract,
    prepareExistingUserOperation,
    prepareIncomingUserOperation,
    estimateErc20PaymasterCost,
    sendUserOperation,
    getTokenQuotes,
    signUserOperation,
  };
};

describe('ERC-20 paymaster quote binding', () => {
  it('verifies the application token against configured and Pimlico-supported tokens', async () => {
    const { context, getTokenQuotes } = makeContext();

    await expect(
      assertErc20PaymasterTokenSupported(context, OTHER_TOKEN),
    ).rejects.toThrow(/differs from the configured paymaster token/);
    expect(getTokenQuotes).not.toHaveBeenCalled();

    getTokenQuotes.mockResolvedValueOnce([]);
    await expect(
      assertErc20PaymasterTokenSupported(context, TOKEN),
    ).rejects.toThrow(/not supported by Pimlico/);

    await expect(
      assertErc20PaymasterTokenSupported(context, TOKEN),
    ).resolves.toBe(TOKEN);
    expect(getTokenQuotes).toHaveBeenLastCalledWith({
      chain: context.network,
      tokens: [TOKEN],
    });
  });

  it('formats token decimals and Pimlico six-decimal USD values', () => {
    expect(formatErc20Fee(TOKEN, 1_250_000n, 2_500_000n, 6)).toMatchObject({
      formattedToken: '1.25',
      formattedUsd: '2.5',
    });
  });

  it('requires real balance for paid locks', async () => {
    const { context } = makeContext({ balance: 999n, cost: 1_000n });

    await expect(
      prepareErc20PaymasterQuote(context, [{ to: TARGET, data: '0x1234' }], {
        type: 'existing',
      }),
    ).rejects.toThrow(/insufficient real ERC-20 balance/);
  });

  it('selects the normal client for existing balance and override only for incoming release', async () => {
    const {
      context,
      prepareExistingUserOperation,
      prepareIncomingUserOperation,
    } = makeContext();
    const calls = [{ to: TARGET, data: '0x1234' as const }];

    await prepareErc20PaymasterQuote(context, calls, { type: 'existing' });
    expect(prepareExistingUserOperation).toHaveBeenCalledOnce();
    expect(prepareIncomingUserOperation).not.toHaveBeenCalled();

    await prepareErc20PaymasterQuote(context, calls, {
      type: 'incoming',
      token: TOKEN,
      amount: 10_000n,
    });
    expect(prepareExistingUserOperation).toHaveBeenCalledOnce();
    expect(prepareIncomingUserOperation).toHaveBeenCalledOnce();
  });

  it('allows an incoming release token only when it matches and covers cost plus headroom', async () => {
    const { context } = makeContext({ balance: 0n, cost: 1_000n });
    const calls = [{ to: TARGET, data: '0x1234' as const }];

    await expect(
      prepareErc20PaymasterQuote(context, calls, {
        type: 'incoming',
        token: OTHER_TOKEN,
        amount: 10_000n,
      }),
    ).rejects.toThrow(/released token differs/);

    await expect(
      prepareErc20PaymasterQuote(context, calls, {
        type: 'incoming',
        token: TOKEN,
        amount: 1_050n,
      }),
    ).rejects.toThrow(/safety margin/);

    await expect(
      prepareErc20PaymasterQuote(context, calls, {
        type: 'incoming',
        token: TOKEN,
        amount: 1_051n,
      }),
    ).resolves.toMatchObject({
      token: TOKEN,
      maxAcceptedTokenCost: 1_000n,
      realTokenBalance: 0n,
    });
  });

  it('signs and sends the exact prepared UserOperation without preparing again', async () => {
    const {
      context,
      prepared,
      prepareExistingUserOperation,
      sendUserOperation,
      signUserOperation,
    } = makeContext();
    const quote = await prepareErc20PaymasterQuote(
      context,
      [{ to: TARGET, data: '0x1234' }],
      { type: 'existing' },
    );

    await expect(sendPreparedErc20UserOperation(context, quote)).resolves.toBe(
      USER_OP_HASH,
    );
    expect(prepareExistingUserOperation).toHaveBeenCalledOnce();
    expect(signUserOperation).toHaveBeenCalledWith(prepared);
    expect(sendUserOperation).toHaveBeenCalledWith({
      ...prepared,
      signature: '0xabcdef',
      entryPointAddress: entryPoint07Address,
    });
  });

  it('rejects expired or mutated quotes before signing/broadcasting', async () => {
    const { context, signUserOperation, sendUserOperation } = makeContext();
    const quote = await prepareErc20PaymasterQuote(
      context,
      [{ to: TARGET, data: '0x1234' }],
      { type: 'existing' },
    );

    quote.expiresAt = 0;
    await expect(
      sendPreparedErc20UserOperation(context, quote),
    ).rejects.toThrow(/quote expired/);
    expect(signUserOperation).not.toHaveBeenCalled();
    expect(sendUserOperation).not.toHaveBeenCalled();

    quote.expiresAt = Date.now() + 60_000;
    quote.userOperation.callData = '0xdead';
    await expect(
      sendPreparedErc20UserOperation(context, quote),
    ).rejects.toThrow(/calldata changed/);
  });
});

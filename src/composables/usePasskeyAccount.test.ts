import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';

const mocks = vi.hoisted(() => ({
  getActiveAaContext: vi.fn(),
  sweepAll: vi.fn(),
}));

vi.mock('@doiim/passkeys/smart-account', () => ({
  addOwner: vi.fn(),
  buildBundlerTransport: vi.fn(),
  buildPaymasterSetup: vi.fn(),
  getTokenBalances: vi.fn(),
  listOwners: vi.fn(),
  listOwnersPublicKeys: vi.fn(),
  sweepAll: mocks.sweepAll,
  toKernelPasskeyAccount: vi.fn(),
  toPasskeyAccount: vi.fn(),
}));
vi.mock('@/blockchain/aaAccount', () => ({
  getActiveAaContext: mocks.getActiveAaContext,
  readPasskeySession: vi.fn(),
}));
vi.mock('@/config/env', () => ({
  env: {
    local: { p2pix: undefined },
    passkey: {
      accountKind: 'kernel',
      pimlicoApiKey: 'test-key',
    },
  },
}));
vi.mock('@/composables/useUser', () => ({
  useUser: () => ({
    network: {
      value: {
        id: 1,
        aa: { paymasterPolicies: { paidOperations: { token: FEE_TOKEN } } },
      },
    },
    walletAddress: { value: undefined },
  }),
}));

import {
  assertSweepPreservesPaymasterFeeToken,
  usePasskeyAccount,
} from './usePasskeyAccount';

const FEE_TOKEN = `0x${'1'.repeat(40)}` as Address;
const OTHER_TOKEN = `0x${'2'.repeat(40)}` as Address;

describe('passkey sweep paymaster safety', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveAaContext.mockResolvedValue({
      erc20Client: {},
      network: {
        aa: { paymasterPolicies: { paidOperations: { token: FEE_TOKEN } } },
      },
    });
  });

  it('blocks sweeping the full fee-token balance before UserOperation preparation', () => {
    expect(() =>
      assertSweepPreservesPaymasterFeeToken([FEE_TOKEN], FEE_TOKEN),
    ).toThrow(/Cannot sweep the ERC-20 paymaster fee token/);
  });

  it('allows non-fee tokens and chains without an ERC-20 paymaster', () => {
    expect(() =>
      assertSweepPreservesPaymasterFeeToken([OTHER_TOKEN], FEE_TOKEN),
    ).not.toThrow();
    expect(() =>
      assertSweepPreservesPaymasterFeeToken([FEE_TOKEN], undefined),
    ).not.toThrow();
  });

  it('does not prepare or send a sweep that would drain the paymaster token', async () => {
    const account = usePasskeyAccount();

    await expect(
      account.sweep([FEE_TOKEN], `0x${'3'.repeat(40)}` as Address),
    ).resolves.toBeNull();
    expect(account.error.value).toMatch(/Cannot sweep.*paymaster fee token/);
    expect(mocks.sweepAll).not.toHaveBeenCalled();
  });
});

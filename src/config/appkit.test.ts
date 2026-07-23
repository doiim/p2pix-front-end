import { beforeEach, describe, expect, it, vi } from 'vitest';

const controllerMocks = vi.hoisted(() => ({
  accountType: undefined as 'eoa' | 'smartAccount' | undefined,
  setPreferredAccountType: vi.fn(),
}));

vi.mock('@doiim/reown-appkit-controllers', () => ({
  ChainController: {
    getAccountData: vi.fn(() => ({
      preferredAccountType: controllerMocks.accountType,
    })),
  },
  ConnectionController: {
    setPreferredAccountType: controllerMocks.setPreferredAccountType,
  },
}));

import { ensureReownEoaAccount, getReownEip155AccountType } from './appkit';

describe('Reown AUTH EOA migration', () => {
  beforeEach(() => {
    controllerMocks.accountType = undefined;
    controllerMocks.setPreferredAccountType.mockReset();
  });

  it('reads the effective account type from AppKit account state', () => {
    controllerMocks.accountType = 'smartAccount';
    expect(getReownEip155AccountType()).toBe('smartAccount');
  });

  it('keeps an existing EOA without reconnecting', async () => {
    controllerMocks.accountType = 'eoa';
    await expect(ensureReownEoaAccount()).resolves.toBe('eoa');
    expect(controllerMocks.setPreferredAccountType).not.toHaveBeenCalled();
  });

  it('migrates a persisted smart account through AppKit and verifies the result', async () => {
    controllerMocks.accountType = 'smartAccount';
    controllerMocks.setPreferredAccountType.mockImplementation(async () => {
      controllerMocks.accountType = 'eoa';
    });

    await expect(ensureReownEoaAccount()).resolves.toBe('eoa');
    expect(controllerMocks.setPreferredAccountType).toHaveBeenCalledWith(
      'eoa',
      'eip155',
    );
  });

  it('coalesces concurrent EOA migrations into one reconnect', async () => {
    controllerMocks.accountType = 'smartAccount';
    controllerMocks.setPreferredAccountType.mockImplementation(async () => {
      controllerMocks.accountType = 'eoa';
    });

    await expect(
      Promise.all([ensureReownEoaAccount(), ensureReownEoaAccount()]),
    ).resolves.toEqual(['eoa', 'eoa']);
    expect(controllerMocks.setPreferredAccountType).toHaveBeenCalledTimes(1);
  });

  it('fails closed when the AUTH provider remains a managed smart account', async () => {
    controllerMocks.accountType = 'smartAccount';
    controllerMocks.setPreferredAccountType.mockResolvedValue(undefined);

    await expect(ensureReownEoaAccount()).rejects.toThrow(
      /must expose an EOA account/,
    );
  });
});

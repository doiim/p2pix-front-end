import { createPublicClient, http } from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import { mainnet } from 'viem/chains';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pimlicoMocks = vi.hoisted(() => ({
  prepareHook: vi.fn(),
  prepareUserOperationForErc20Paymaster: vi.fn(),
  sponsorUserOperation: vi.fn(),
}));
const accountMocks = vi.hoisted(() => ({
  toKernelPasskeyAccount: vi.fn(),
  toKernelSmartAccount: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({
  ensureReownEoaAccount: vi.fn(),
  getAccount: vi.fn(),
  getPublicClient: vi.fn(),
  getWagmiConfig: vi.fn(() => ({})),
  getWalletClient: vi.fn(),
  useUser: vi.fn(),
}));

vi.mock('permissionless/experimental/pimlico', () => ({
  prepareUserOperationForErc20Paymaster:
    pimlicoMocks.prepareUserOperationForErc20Paymaster,
}));
vi.mock('permissionless/clients/pimlico', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('permissionless/clients/pimlico')>();
  return {
    ...original,
    createPimlicoClient: vi.fn((parameters) => ({
      ...original.createPimlicoClient(parameters),
      sponsorUserOperation: pimlicoMocks.sponsorUserOperation,
    })),
  };
});
vi.mock('permissionless/accounts', () => ({
  toKernelSmartAccount: accountMocks.toKernelSmartAccount,
}));
vi.mock('@doiim/passkeys/smart-account', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@doiim/passkeys/smart-account')>()),
  toKernelPasskeyAccount: accountMocks.toKernelPasskeyAccount,
}));
vi.mock('@wagmi/core', () => ({ getAccount: runtimeMocks.getAccount }));
vi.mock('@/config/appkit', () => ({
  ensureReownEoaAccount: runtimeMocks.ensureReownEoaAccount,
  getWagmiConfig: runtimeMocks.getWagmiConfig,
}));
vi.mock('@/composables/useUser', () => ({ useUser: runtimeMocks.useUser }));
vi.mock('./provider', () => ({
  getPublicClient: runtimeMocks.getPublicClient,
  getWalletClient: runtimeMocks.getWalletClient,
}));

import {
  PASSKEY_CONNECTOR_ID,
  REOWN_AUTH_CONNECTOR_ID,
  buildPolicyScopedClients,
  getAaAccountForRuntime,
  getActiveAaContext,
  getAaContextForRuntime,
  getAaOwnerKind,
  getEffectiveWalletAddress,
  readPasskeySession,
  resetAaAccountCache,
  validateAaPaymasterPolicies,
} from './aaAccount';
import type { NetworkConfig } from '@/model/NetworkEnum';

const PAYMASTER_TOKEN = `0x${'2'.repeat(40)}` as const;
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://rpc.example'),
});
const network = {
  ...mainnet,
  tokens: { BRZ: { address: PAYMASTER_TOKEN } },
  subgraphUrls: [],
  aa: {
    paymasterPolicies: {
      firstLock: { sponsorshipPolicyId: 'sp_first_lock' },
      paidOperations: { token: PAYMASTER_TOKEN },
    },
  },
} as NetworkConfig;

describe('AA owner routing', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    });
    resetAaAccountCache();
    vi.clearAllMocks();
    runtimeMocks.ensureReownEoaAccount.mockResolvedValue('eoa');
    runtimeMocks.getPublicClient.mockReturnValue(publicClient);
    runtimeMocks.useUser.mockReturnValue({ network: { value: network } });
  });

  it('selects only the passkey and Reown embedded-wallet connectors', () => {
    expect(getAaOwnerKind(PASSKEY_CONNECTOR_ID)).toBe('passkey');
    expect(getAaOwnerKind(REOWN_AUTH_CONNECTOR_ID)).toBe('reown');
    expect(getAaOwnerKind('injected')).toBeNull();
    expect(getAaOwnerKind('walletConnect')).toBeNull();
  });

  it('returns null for an external wallet without touching AA clients', async () => {
    await expect(
      getAaContextForRuntime({
        connectorId: 'injected',
        publicClient: {} as never,
        network,
      }),
    ).resolves.toBeNull();
  });

  it('never treats a known AA connector on an unsupported chain as an EOA', async () => {
    runtimeMocks.getAccount.mockReturnValue({
      connector: { id: PASSKEY_CONNECTOR_ID },
    });
    runtimeMocks.useUser.mockReturnValue({
      network: { value: { ...network, aa: undefined } },
    });

    await expect(getActiveAaContext()).rejects.toThrow(
      /AA is not configured.*refusing to use the connector EOA/,
    );
  });

  it('ignores malformed passkey storage', () => {
    window.localStorage.setItem('doiim:passkey', '{not-json');
    expect(readPasskeySession()).toBeNull();
  });

  it('reads a complete passkey session', () => {
    const session = {
      credentialId: 'credential',
      smartAccountAddress: `0x${'1'.repeat(40)}`,
      publicKeyX: `0x${'1'.repeat(64)}`,
      publicKeyY: `0x${'2'.repeat(64)}`,
      salt: `0x${'0'.repeat(64)}`,
    };
    window.localStorage.setItem('doiim:passkey', JSON.stringify(session));
    expect(readPasskeySession()).toEqual(session);
  });

  it('repairs a legacy Exactly session before allowing Kernel use', async () => {
    const session = {
      credentialId: 'credential',
      smartAccountAddress: `0x${'1'.repeat(40)}`,
      publicKeyX: `0x${'1'.repeat(64)}`,
      publicKeyY: `0x${'2'.repeat(64)}`,
      salt: `0x${'0'.repeat(64)}`,
    };
    const kernelAccount = {
      address: `0x${'9'.repeat(40)}`,
      client: publicClient,
      entryPoint: { address: `0x${'3'.repeat(40)}`, version: '0.7' },
    } as unknown as SmartAccount;
    window.localStorage.setItem('doiim:passkey', JSON.stringify(session));
    accountMocks.toKernelPasskeyAccount.mockResolvedValue(kernelAccount);

    await expect(
      getAaAccountForRuntime({
        connectorId: PASSKEY_CONNECTOR_ID,
        publicClient,
        network,
      }),
    ).rejects.toThrow(/migrated to the Kernel account.*reload/);

    expect(
      JSON.parse(window.localStorage.getItem('doiim:passkey') ?? '{}'),
    ).toMatchObject({ smartAccountAddress: kernelAccount.address });
    expect(
      JSON.parse(
        window.localStorage.getItem('doiim:passkey:credentials') ?? '{}',
      ),
    ).toMatchObject({
      credential: { smartAccountAddress: kernelAccount.address },
    });
  });

  it('derives the Reown Kernel address without requiring paymaster policies', async () => {
    const counterfactual = {
      address: `0x${'9'.repeat(40)}`,
      client: publicClient,
      entryPoint: { address: `0x${'3'.repeat(40)}`, version: '0.7' },
    } as unknown as SmartAccount;
    const walletClient = {
      account: { address: `0x${'8'.repeat(40)}` },
    } as never;
    accountMocks.toKernelSmartAccount.mockResolvedValue(counterfactual);

    await expect(
      getAaAccountForRuntime({
        connectorId: REOWN_AUTH_CONNECTOR_ID,
        publicClient,
        walletClient,
        reownAccountType: 'eoa',
        network: {
          ...network,
          aa: { paymasterPolicies: {} },
        },
      }),
    ).resolves.toBe(counterfactual);
  });

  it('rejects a Reown managed smart account as Kernel ECDSA owner', async () => {
    await expect(
      getAaAccountForRuntime({
        connectorId: REOWN_AUTH_CONNECTOR_ID,
        publicClient,
        walletClient: {
          account: { address: `0x${'8'.repeat(40)}` },
        } as never,
        reownAccountType: 'smartAccount',
        network,
      }),
    ).rejects.toThrow(/smartAccount.*Kernel ECDSA owner/);
    expect(accountMocks.toKernelSmartAccount).not.toHaveBeenCalled();
  });

  it('rejects a non-loopback bundler for local self-funded AA', async () => {
    const counterfactual = {
      address: `0x${'9'.repeat(40)}`,
      entryPoint: { address: `0x${'3'.repeat(40)}`, version: '0.7' },
    } as unknown as SmartAccount;
    accountMocks.toKernelSmartAccount.mockResolvedValue(counterfactual);

    await expect(
      getAaContextForRuntime({
        connectorId: REOWN_AUTH_CONNECTOR_ID,
        publicClient: { getChainId: vi.fn().mockResolvedValue(31337) } as never,
        walletClient: {
          account: { address: `0x${'8'.repeat(40)}` },
        } as never,
        reownAccountType: 'eoa',
        network: {
          ...network,
          id: 31337,
          aa: {
            bundlerUrl: 'https://bundler.example',
            paymasterPolicies: {},
            localSelfFunded: true,
          },
        },
      }),
    ).rejects.toThrow(/loopback HTTP bundler/);
  });

  it('never enables local self-funding outside Anvil chain 31337', async () => {
    const counterfactual = {
      address: `0x${'9'.repeat(40)}`,
      entryPoint: { address: `0x${'3'.repeat(40)}`, version: '0.7' },
    } as unknown as SmartAccount;
    accountMocks.toKernelSmartAccount.mockResolvedValue(counterfactual);

    await expect(
      getAaContextForRuntime({
        connectorId: REOWN_AUTH_CONNECTOR_ID,
        publicClient: { getChainId: vi.fn().mockResolvedValue(1) } as never,
        walletClient: {
          account: { address: `0x${'8'.repeat(40)}` },
        } as never,
        reownAccountType: 'eoa',
        network: {
          ...network,
          aa: {
            bundlerUrl: 'http://127.0.0.1:4337',
            paymasterPolicies: {},
            localSelfFunded: true,
          },
        },
      }),
    ).rejects.toThrow(/restricted to Anvil chain 31337/);
  });

  it('uses the counterfactual address even when paymaster policies are absent', async () => {
    const fallback = `0x${'8'.repeat(40)}` as const;
    const counterfactual = {
      address: `0x${'9'.repeat(40)}`,
      client: publicClient,
      entryPoint: { address: `0x${'3'.repeat(40)}`, version: '0.7' },
    } as unknown as SmartAccount;
    runtimeMocks.getAccount.mockReturnValue({
      connector: { id: REOWN_AUTH_CONNECTOR_ID },
      address: fallback,
    });
    runtimeMocks.getWalletClient.mockResolvedValue({
      account: { address: fallback },
    });
    runtimeMocks.useUser.mockReturnValue({
      network: { value: { ...network, aa: { paymasterPolicies: {} } } },
    });
    accountMocks.toKernelSmartAccount.mockResolvedValue(counterfactual);

    await expect(getEffectiveWalletAddress(fallback)).resolves.toBe(
      counterfactual.address,
    );
  });

  it('never falls back to the Reown EOA when EOA migration fails', async () => {
    const fallback = `0x${'8'.repeat(40)}` as const;
    runtimeMocks.getAccount.mockReturnValue({
      connector: { id: REOWN_AUTH_CONNECTOR_ID },
      address: fallback,
    });
    runtimeMocks.ensureReownEoaAccount.mockRejectedValue(
      new Error('AUTH remained smartAccount'),
    );

    await expect(getEffectiveWalletAddress(fallback)).rejects.toThrow(
      'AUTH remained smartAccount',
    );
  });
});

describe('AA operation policy clients', () => {
  const account = {
    address: `0x${'1'.repeat(40)}`,
    client: publicClient,
    entryPoint: {
      address: `0x${'3'.repeat(40)}`,
      version: '0.7',
    },
  } as unknown as SmartAccount;

  it('requires both a first-lock sponsor and an ERC-20 paid-operation token', () => {
    expect(() =>
      validateAaPaymasterPolicies({
        paymasterPolicies: {
          paidOperations: { token: PAYMASTER_TOKEN },
        },
      }),
    ).toThrow(/firstLock.*sponsorshipPolicyId/);

    expect(() =>
      validateAaPaymasterPolicies({
        paymasterPolicies: {
          firstLock: { sponsorshipPolicyId: '   ' },
          paidOperations: { token: PAYMASTER_TOKEN },
        },
      }),
    ).toThrow(/firstLock.*sponsorshipPolicyId/);

    expect(() =>
      validateAaPaymasterPolicies({
        paymasterPolicies: {
          firstLock: { sponsorshipPolicyId: 'sp_first_lock' },
          paidOperations: { token: '0x' },
        },
      }),
    ).toThrow(/paidOperations.*token/);
  });

  it('binds sponsored operations to pm_sponsorUserOperation', async () => {
    pimlicoMocks.prepareUserOperationForErc20Paymaster.mockReturnValue(
      pimlicoMocks.prepareHook,
    );
    pimlicoMocks.sponsorUserOperation.mockResolvedValue({
      callGasLimit: 1n,
      verificationGasLimit: 2n,
      preVerificationGas: 3n,
      paymaster: `0x${'4'.repeat(40)}`,
      paymasterVerificationGasLimit: 4n,
      paymasterPostOpGasLimit: 5n,
      paymasterData: '0x1234',
    });

    const result = buildPolicyScopedClients({
      account,
      network,
      publicClient,
      url: 'https://pimlico.example',
    });

    expect(result.sponsoredClient.account).toBe(account);
    expect(result.erc20Client.account).toBe(account);
    expect(result.erc20IncomingClient.account).toBe(account);
    expect(result.sponsoredClient.paymaster).not.toBe(
      result.erc20Client.paymaster,
    );
    expect(result.erc20IncomingClient.paymaster).toBe(
      result.erc20Client.paymaster,
    );
    // A static policy context would allow callers to bypass the one-time grant.
    // The sponsored operation must provide its authorization-bound context.
    expect(result.sponsoredClient.paymasterContext).toBeUndefined();
    expect(result.erc20Client.paymasterContext).toEqual({
      token: PAYMASTER_TOKEN,
    });
    expect(result.erc20IncomingClient.paymasterContext).toEqual({
      token: PAYMASTER_TOKEN,
    });
    expect(result.erc20Client.paymasterContext).not.toHaveProperty(
      'sponsorshipPolicyId',
    );
    expect(result.erc20Client.paymasterContext).not.toHaveProperty('guarantor');
    const grantContext = {
      sponsorshipPolicyId: 'sp_first_lock',
      meta: { authorizationId: 'grant-1' },
    };
    const sponsoredPaymaster = result.sponsoredClient.paymaster;
    expect(typeof sponsoredPaymaster).toBe('object');
    if (typeof sponsoredPaymaster !== 'object' || !sponsoredPaymaster) {
      throw new Error('Expected a sponsored paymaster adapter');
    }
    const sponsorship = await sponsoredPaymaster.getPaymasterStubData?.({
      sender: account.address,
      nonce: 0n,
      callData: '0x1234',
      chainId: network.id,
      entryPointAddress: account.entryPoint.address,
      context: grantContext,
    });
    expect(pimlicoMocks.sponsorUserOperation).toHaveBeenCalledWith({
      userOperation: expect.objectContaining({
        sender: account.address,
        callData: '0x1234',
      }),
      sponsorshipPolicyId: 'sp_first_lock',
      paymasterContext: grantContext,
    });
    expect(sponsorship).toMatchObject({
      paymaster: `0x${'4'.repeat(40)}`,
      paymasterData: '0x1234',
      isFinal: true,
    });
    expect(
      pimlicoMocks.prepareUserOperationForErc20Paymaster,
    ).toHaveBeenNthCalledWith(1, result.pimlicoClient, {
      balanceOverride: false,
    });
    expect(
      pimlicoMocks.prepareUserOperationForErc20Paymaster,
    ).toHaveBeenNthCalledWith(2, result.pimlicoClient, {
      balanceOverride: true,
    });
  });
});

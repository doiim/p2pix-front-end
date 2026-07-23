import { getAccount } from '@wagmi/core';
import type { StoredSession } from '@doiim/passkeys/storage';
import { toKernelPasskeyAccount } from '@doiim/passkeys/smart-account';
import {
  type Account,
  type Address,
  type Chain,
  type PublicClient,
  type Transport,
  type WalletClient,
  http,
  isAddress,
  isHex,
  parseEther,
  toHex,
  zeroAddress,
} from 'viem';
import {
  createPaymasterClient,
  entryPoint07Address,
  type GetPaymasterStubDataParameters,
  type GetPaymasterStubDataReturnType,
  type SmartAccount,
  type UserOperation,
} from 'viem/account-abstraction';
import {
  createSmartAccountClient,
  type SmartAccountClient,
} from 'permissionless';
import {
  createPimlicoClient,
  type PimlicoClient,
} from 'permissionless/clients/pimlico';
import { toKernelSmartAccount } from 'permissionless/accounts';
import { prepareUserOperationForErc20Paymaster } from 'permissionless/experimental/pimlico';

import {
  ensureReownEoaAccount,
  getWagmiConfig,
  type ReownEip155AccountType,
} from '@/config/appkit';
import { env } from '@/config/env';
import type { AaNetworkConfig, NetworkConfig } from '@/model/NetworkEnum';
import { useUser } from '@/composables/useUser';
import { getPublicClient, getWalletClient } from './provider';

export const PASSKEY_CONNECTOR_ID = 'doiim-passkey';
export const REOWN_AUTH_CONNECTOR_ID = 'AUTH';
export const PASSKEY_SESSION_KEY = 'doiim:passkey';

export type AaOwnerKind = 'passkey' | 'reown';

export type AaContext = {
  account: SmartAccount;
  sponsoredClient: SmartAccountClient;
  /** Paid operations that must already have a real ERC-20 balance. */
  erc20Client: SmartAccountClient;
  /** Release-only client: token balance arrives during the same UserOperation. */
  erc20IncomingClient: SmartAccountClient;
  ownerKind: AaOwnerKind;
  network: NetworkConfig;
  fundingMode: 'paymaster' | 'self-funded';
  /** First-lock subsidy gating. Defaults to backendless `caps-only`. */
  sponsorshipMode: 'caps-only' | 'backend';
  pimlicoClient?: PimlicoClient;
};

export type AaRuntime = {
  connectorId?: string;
  publicClient: PublicClient;
  walletClient?: WalletClient | null;
  /** Reown's canonical AUTH account type; viem's account.type is insufficient. */
  reownAccountType?: ReownEip155AccountType;
  network: NetworkConfig;
};

const accountCache = new Map<string, Promise<SmartAccount>>();
const clientCache = new Map<string, Promise<AaContext>>();

const cachePromise = <T>(
  cache: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
): Promise<T> => {
  let pending = cache.get(key);
  if (!pending) {
    pending = factory();
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
};

export const getAaOwnerKind = (connectorId?: string): AaOwnerKind | null => {
  if (connectorId === PASSKEY_CONNECTOR_ID) return 'passkey';
  if (connectorId === REOWN_AUTH_CONNECTOR_ID) return 'reown';
  return null;
};

export const readPasskeySession = (): StoredSession | null => {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(PASSKEY_SESSION_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      typeof parsed.credentialId === 'string' &&
      parsed.credentialId.length > 0 &&
      typeof parsed.smartAccountAddress === 'string' &&
      isAddress(parsed.smartAccountAddress) &&
      typeof parsed.publicKeyX === 'string' &&
      isHex(parsed.publicKeyX) &&
      parsed.publicKeyX.length === 66 &&
      typeof parsed.publicKeyY === 'string' &&
      isHex(parsed.publicKeyY) &&
      parsed.publicKeyY.length === 66 &&
      typeof parsed.salt === 'string' &&
      isHex(parsed.salt) &&
      parsed.salt.length === 66
    ) {
      return parsed as StoredSession;
    }
  } catch {
    // Corrupt storage is treated as a logged-out passkey session.
  }
  return null;
};

const persistMigratedPasskeySession = (session: StoredSession): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PASSKEY_SESSION_KEY, JSON.stringify(session));
  // A legacy credentials map can contain several stale Exactly addresses.
  // Keep only the authenticated credential; other passkeys self-repair when
  // they are selected again.
  window.localStorage.setItem(
    'doiim:passkey:credentials',
    JSON.stringify({
      [session.credentialId]: {
        smartAccountAddress: session.smartAccountAddress,
        publicKeyX: session.publicKeyX,
        publicKeyY: session.publicKeyY,
        salt: session.salt,
      },
    }),
  );
};

export const resetAaAccountCache = (): void => {
  accountCache.clear();
  clientCache.clear();
};

const pimlicoUrl = (chainId: number, aa: AaNetworkConfig): string | undefined =>
  aa.bundlerUrl ??
  (env.passkey.pimlicoApiKey
    ? `https://api.pimlico.io/v2/${chainId}/rpc?apikey=${env.passkey.pimlicoApiKey}`
    : undefined);

const isLoopbackBundlerUrl = (value: string): boolean => {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' ||
        url.hostname === 'localhost' ||
        url.hostname === '[::1]')
    );
  } catch {
    return false;
  }
};

export const validateAaPaymasterPolicies = (aa: AaNetworkConfig) => {
  const firstLock = aa.paymasterPolicies.firstLock;
  if (!firstLock?.sponsorshipPolicyId.trim()) {
    throw new Error('AA firstLock sponsorshipPolicyId is required');
  }

  const paidOperations = aa.paymasterPolicies.paidOperations;
  if (
    !paidOperations ||
    !isAddress(paidOperations.token) ||
    paidOperations.token.toLowerCase() === zeroAddress
  ) {
    throw new Error('AA paidOperations ERC-20 token is required');
  }

  return { firstLock, paidOperations };
};

export const buildPolicyScopedClients = ({
  account,
  network,
  publicClient,
  url,
}: {
  account: SmartAccount;
  network: NetworkConfig;
  publicClient: PublicClient;
  url: string;
}) => {
  const aa = network.aa;
  if (!aa) throw new Error(`AA is not configured for chain ${network.id}`);
  const { firstLock, paidOperations } = validateAaPaymasterPolicies(aa);
  const pimlicoClient = createPimlicoClient({
    chain: network as Chain,
    transport: http(url),
    entryPoint: account.entryPoint,
  });
  const erc20Paymaster = createPaymasterClient({ transport: http(url) });
  const estimateFeesPerGas = async () =>
    (await pimlicoClient.getUserOperationGasPrice()).fast;
  const common = {
    account,
    chain: network as Chain,
    client: publicClient,
    bundlerTransport: http(url),
  } as const;
  const sponsoredPaymaster = {
    getPaymasterStubData: async ({
      chainId,
      context,
      entryPointAddress,
      ...request
    }: GetPaymasterStubDataParameters): Promise<GetPaymasterStubDataReturnType> => {
      if (
        chainId !== network.id ||
        entryPointAddress.toLowerCase() !==
          account.entryPoint.address.toLowerCase() ||
        account.entryPoint.version !== '0.7'
      ) {
        throw new Error(
          'Sponsored UserOperation context does not match Kernel',
        );
      }

      const result = await pimlicoClient.sponsorUserOperation({
        userOperation: request as UserOperation<'0.7'>,
        sponsorshipPolicyId: firstLock.sponsorshipPolicyId,
        paymasterContext: context,
      });
      return { ...result, isFinal: true };
    },
  };
  const sponsoredClient = createSmartAccountClient({
    ...common,
    paymaster: sponsoredPaymaster,
    userOperation: { estimateFeesPerGas },
  });
  const buildErc20Client = (balanceOverride: boolean) =>
    createSmartAccountClient({
      ...common,
      paymaster: erc20Paymaster,
      paymasterContext: { token: paidOperations.token },
      userOperation: {
        estimateFeesPerGas,
        prepareUserOperation: prepareUserOperationForErc20Paymaster(
          pimlicoClient,
          { balanceOverride },
        ),
      },
    });
  const erc20Client = buildErc20Client(false);
  const erc20IncomingClient = buildErc20Client(true);

  return {
    sponsoredClient,
    erc20Client,
    erc20IncomingClient,
    pimlicoClient,
  };
};

const buildLocalSelfFundedClients = async ({
  account,
  network,
  publicClient,
  url,
}: {
  account: SmartAccount;
  network: NetworkConfig;
  publicClient: PublicClient;
  url: string;
}) => {
  const runtimeChainId = await publicClient.getChainId();
  if (network.id !== 31337 || runtimeChainId !== 31337) {
    throw new Error('Local self-funded AA is restricted to Anvil chain 31337');
  }

  const minimumBalance = parseEther('10');
  if (
    (await publicClient.getBalance({ address: account.address })) <
    minimumBalance
  ) {
    await publicClient.request({
      method: 'anvil_setBalance',
      params: [account.address, toHex(parseEther('100'))],
    } as never);
  }

  const pimlicoClient = createPimlicoClient({
    chain: network as Chain,
    transport: http(url),
    entryPoint: account.entryPoint,
  });
  const common = {
    account,
    chain: network as Chain,
    client: publicClient,
    bundlerTransport: http(url),
    userOperation: {
      estimateFeesPerGas: async () =>
        (await pimlicoClient.getUserOperationGasPrice()).fast,
    },
  } as const;

  // Keep clients isolated by operation even though local Anvil does not use a
  // paymaster. Production must never accidentally collapse these policy seams.
  return {
    sponsoredClient: createSmartAccountClient(common),
    erc20Client: createSmartAccountClient(common),
    erc20IncomingClient: createSmartAccountClient(common),
    pimlicoClient,
  };
};

const getRuntimeOwnerIdentity = (
  runtime: AaRuntime,
  ownerKind: AaOwnerKind,
): string | undefined => {
  if (ownerKind === 'passkey') return readPasskeySession()?.credentialId;
  return runtime.walletClient?.account?.address.toLowerCase();
};

const createKernelAccount = async (
  runtime: AaRuntime,
  ownerKind: AaOwnerKind,
): Promise<SmartAccount> => {
  const { publicClient } = runtime;

  if (ownerKind === 'passkey') {
    const session = readPasskeySession();
    if (!session) throw new Error('Passkey session not available');
    const account = await toKernelPasskeyAccount({
      client: publicClient,
      credentialId: session.credentialId,
      publicKeyX: session.publicKeyX,
      publicKeyY: session.publicKeyY,
      rpId: env.passkey.rpId,
    });
    if (
      session.smartAccountAddress.toLowerCase() !==
      account.address.toLowerCase()
    ) {
      const migrated = {
        ...session,
        smartAccountAddress: account.address,
      };
      persistMigratedPasskeySession(migrated);
      throw new Error(
        'Passkey session migrated to the Kernel account; reload once to reconnect safely',
      );
    }
    return account;
  }

  if (runtime.reownAccountType !== 'eoa') {
    throw new Error(
      'Reown AUTH smartAccount cannot be used as a Kernel ECDSA owner; switch AUTH to eoa first',
    );
  }

  const owner = runtime.walletClient;
  if (!owner?.account) throw new Error('Reown EOA signer not available');
  return toKernelSmartAccount({
    client: publicClient,
    version: '0.3.1',
    owners: [owner as WalletClient<Transport, Chain | undefined, Account>],
    entryPoint: { address: entryPoint07Address, version: '0.7' },
  });
};

/**
 * Resolve the counterfactual Kernel account without requiring a bundler or
 * either paymaster policy. Deployment still happens only in the first UserOp.
 */
export const getAaAccountForRuntime = async (
  runtime: AaRuntime,
): Promise<SmartAccount | null> => {
  const ownerKind = getAaOwnerKind(runtime.connectorId);
  if (!ownerKind || !runtime.network.aa) return null;

  const ownerIdentity = getRuntimeOwnerIdentity(runtime, ownerKind);
  if (!ownerIdentity) return null;

  // Passkey credential IDs are base64url and case-sensitive. EVM addresses
  // were normalized by getRuntimeOwnerIdentity above.
  const key = `${runtime.network.id}:${ownerKind}:${ownerIdentity}`;
  return cachePromise(accountCache, key, () =>
    createKernelAccount(runtime, ownerKind),
  );
};

const createContext = async (
  runtime: AaRuntime,
  ownerKind: AaOwnerKind,
  account: SmartAccount,
): Promise<AaContext> => {
  const { network, publicClient } = runtime;
  const aa = network.aa;
  if (!aa) throw new Error(`AA is not configured for chain ${network.id}`);

  const url = aa.localSelfFunded ? aa.bundlerUrl : pimlicoUrl(network.id, aa);
  if (!url) {
    throw new Error(
      `Bundler not configured for chain ${network.id}: set VITE_PIMLICO_API_KEY or a chain bundler URL`,
    );
  }
  if (aa.localSelfFunded && !isLoopbackBundlerUrl(url)) {
    throw new Error(
      'Local self-funded AA requires a loopback HTTP bundler URL',
    );
  }

  const fundingMode = aa.localSelfFunded ? 'self-funded' : 'paymaster';
  const { sponsoredClient, erc20Client, erc20IncomingClient, pimlicoClient } =
    aa.localSelfFunded
      ? await buildLocalSelfFundedClients({
          account,
          network,
          publicClient,
          url,
        })
      : buildPolicyScopedClients({
          account,
          network,
          publicClient,
          url,
        });

  return {
    account,
    sponsoredClient,
    erc20Client,
    erc20IncomingClient,
    ownerKind,
    network,
    fundingMode,
    sponsorshipMode: aa.sponsorshipMode ?? 'caps-only',
    pimlicoClient,
  };
};

export const getAaContextForRuntime = async (
  runtime: AaRuntime,
): Promise<AaContext | null> => {
  const ownerKind = getAaOwnerKind(runtime.connectorId);
  if (!ownerKind || !runtime.network.aa) return null;

  const account = await getAaAccountForRuntime(runtime);
  if (!account) return null;

  const key = `${runtime.network.id}:${ownerKind}:${account.address.toLowerCase()}`;
  return cachePromise(clientCache, key, () =>
    createContext(runtime, ownerKind, account),
  );
};

const resolveActiveRuntime = async (
  ownerKind: AaOwnerKind,
  network: NetworkConfig,
): Promise<AaRuntime> => {
  if (ownerKind === 'reown') {
    // This uses AppKit's real account-type state and supported migration API.
    // Fetch the WalletClient only after reconnecting as EOA so an old managed
    // smart-account address cannot be cached as Kernel's ECDSA owner.
    const reownAccountType = await ensureReownEoaAccount();
    return {
      connectorId: REOWN_AUTH_CONNECTOR_ID,
      publicClient: getPublicClient(),
      walletClient: await getWalletClient(),
      reownAccountType,
      network,
    };
  }

  return {
    connectorId: PASSKEY_CONNECTOR_ID,
    publicClient: getPublicClient(),
    network,
  };
};

/** Resolve the active app connection into the unified Kernel rail. */
export const getActiveAaContext = async (): Promise<AaContext | null> => {
  const connection = getAccount(getWagmiConfig());
  const ownerKind = getAaOwnerKind(connection.connector?.id);
  if (!ownerKind) return null;

  const network = useUser().network.value;
  if (!network.aa) {
    throw new Error(
      `AA is not configured for chain ${network.id}; refusing to use the connector EOA`,
    );
  }

  const context = await getAaContextForRuntime(
    await resolveActiveRuntime(ownerKind, network),
  );
  if (!context) {
    throw new Error(
      `Could not resolve the ${ownerKind} AA context on chain ${network.id}; refusing to use the connector EOA`,
    );
  }
  return context;
};

/** Resolve only the active counterfactual account, independent of AA infra. */
export const getActiveAaAccount = async (): Promise<SmartAccount | null> => {
  const connection = getAccount(getWagmiConfig());
  const ownerKind = getAaOwnerKind(connection.connector?.id);
  if (!ownerKind) return null;

  const network = useUser().network.value;
  if (!network.aa) {
    throw new Error(`AA is not configured for chain ${network.id}`);
  }

  return getAaAccountForRuntime(await resolveActiveRuntime(ownerKind, network));
};

export const getEffectiveWalletAddress = async (
  fallback?: Address,
): Promise<Address | undefined> => {
  const connection = getAccount(getWagmiConfig());
  const ownerKind = getAaOwnerKind(connection.connector?.id);
  if (!ownerKind) return fallback;

  const account = await getActiveAaAccount();
  if (account) return account.address;

  throw new Error(
    `Could not derive the ${ownerKind} Kernel account; refusing to use the connector EOA`,
  );
};

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
  zeroAddress,
} from 'viem';
import {
  createPaymasterClient,
  entryPoint07Address,
  type SmartAccount,
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
      parsed.credentialId &&
      parsed.smartAccountAddress &&
      parsed.publicKeyX &&
      parsed.publicKeyY &&
      parsed.salt
    ) {
      return parsed as StoredSession;
    }
  } catch {
    // Corrupt storage is treated as a logged-out passkey session.
  }
  return null;
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
  const paymaster = createPaymasterClient({ transport: http(url) });
  const estimateFeesPerGas = async () =>
    (await pimlicoClient.getUserOperationGasPrice()).fast;
  const common = {
    account,
    chain: network as Chain,
    client: publicClient,
    bundlerTransport: http(url),
    paymaster,
  } as const;
  const sponsoredClient = createSmartAccountClient({
    ...common,
    paymasterContext: {
      sponsorshipPolicyId: firstLock.sponsorshipPolicyId,
    },
    userOperation: { estimateFeesPerGas },
  });
  const buildErc20Client = (balanceOverride: boolean) =>
    createSmartAccountClient({
      ...common,
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
    return toKernelPasskeyAccount({
      client: publicClient,
      credentialId: session.credentialId,
      publicKeyX: session.publicKeyX,
      publicKeyY: session.publicKeyY,
      rpId: env.passkey.rpId,
    });
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

  // Local development keeps the existing exactly-mode account and v0.6
  // self-bundler. The generic Kernel rail targets EntryPoint v0.7.
  if (runtime.network.id === 31337) return null;

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

  const url = pimlicoUrl(network.id, aa);
  if (!url) {
    throw new Error(
      `Bundler not configured for chain ${network.id}: set VITE_PIMLICO_API_KEY or a chain bundler URL`,
    );
  }

  const { sponsoredClient, erc20Client, erc20IncomingClient, pimlicoClient } =
    buildPolicyScopedClients({
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
    pimlicoClient,
  };
};

export const getAaContextForRuntime = async (
  runtime: AaRuntime,
): Promise<AaContext | null> => {
  const ownerKind = getAaOwnerKind(runtime.connectorId);
  if (!ownerKind || !runtime.network.aa) return null;

  // Local development keeps the existing exactly-mode account and v0.6
  // self-bundler. The generic Kernel rail targets EntryPoint v0.7.
  if (runtime.network.id === 31337) return null;

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
  if (!network.aa) return null;

  return getAaContextForRuntime(await resolveActiveRuntime(ownerKind, network));
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

  // The local passkey connector already exposes its exactly-mode smart-account
  // address, so this is not an owner-EOA fallback.
  if (ownerKind === 'passkey' && useUser().network.value.id === 31337) {
    return fallback;
  }

  throw new Error(
    `Could not derive the ${ownerKind} Kernel account; refusing to use the connector EOA`,
  );
};

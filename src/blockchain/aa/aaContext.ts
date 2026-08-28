import {
  toKernelAccount,
  toKernelPasskeyAccount,
  buildOperationScopedPimlicoClients,
} from '@doiim/passkeys/smart-account';
import type { Account, Chain, Transport, WalletClient } from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';

import {
  rpIdDefault,
  sponsorshipPolicyId as configuredSponsorshipPolicyId,
} from '@/config/aa';
import { TokenEnum, type NetworkConfig } from '@/model/NetworkEnum';
import { getAaOwnerKind, readPasskeySession } from './session';
import type { AaContext, AaOwnerKind, AaRuntime } from './types';

/** AA is usable only with a bundler and, on Pimlico, a sponsorship policy. */
export const isAaAvailable = (network: NetworkConfig): boolean => {
  if (!network.aa?.bundlerUrl) return false;
  return Boolean(configuredSponsorshipPolicyId());
};

const aaAccountCache = new Map<string, Promise<SmartAccount>>();
const aaContextCache = new Map<string, Promise<AaContext>>();

export const resetAaAccountCache = (): void => {
  aaAccountCache.clear();
  aaContextCache.clear();
};

const cachePromise = <T>(
  cache: Map<string, Promise<T>>,
  key: string,
  factory: () => Promise<T>,
): Promise<T> => {
  let pending = cache.get(key);
  if (!pending) {
    pending = factory();
    cache.set(key, pending);
    pending.catch(() => {
      if (cache.get(key) === pending) cache.delete(key);
    });
  }
  return pending;
};

const getRuntimeOwnerIdentity = (
  runtime: AaRuntime,
  ownerKind: AaOwnerKind,
): string | undefined =>
  ownerKind === 'passkey'
    ? readPasskeySession()?.credentialId
    : runtime.walletClient?.account?.address.toLowerCase();

const createKernelAccount = async (
  runtime: AaRuntime,
  ownerKind: AaOwnerKind,
): Promise<SmartAccount> => {
  const { publicClient, network } = runtime;
  if (ownerKind === 'passkey') {
    const session = readPasskeySession();
    if (!session) throw new Error('Passkey session not available');
    return toKernelPasskeyAccount({
      client: publicClient,
      credentialId: session.credentialId,
      publicKeyX: session.publicKeyX,
      publicKeyY: session.publicKeyY,
      rpId: network.aa?.rpId ?? rpIdDefault,
    });
  }

  const owner = runtime.walletClient;
  if (!owner?.account) throw new Error('Reown EOA signer not available');
  return toKernelAccount({
    client: publicClient,
    owner: owner as WalletClient<Transport, Chain | undefined, Account>,
  });
};

const createContext = async (
  runtime: AaRuntime,
  ownerKind: AaOwnerKind,
  account: SmartAccount,
): Promise<AaContext> => {
  const { network, publicClient } = runtime;
  const aa = network.aa;
  if (!aa) throw new Error(`AA is not configured for chain ${network.id}`);

  const bundlerUrl = aa.bundlerUrl;
  if (!bundlerUrl) {
    throw new Error(`Bundler URL not configured for chain ${network.id}`);
  }

  const sponsorshipPolicyId = configuredSponsorshipPolicyId();
  if (!sponsorshipPolicyId) {
    throw new Error(
      `VITE_PIMLICO_SPONSORSHIP_POLICY_ID is required for chain ${network.id}`,
    );
  }

  const common = {
    account,
    chain: network,
    publicClient,
    bundlerUrl,
    sponsorshipPolicyId,
    erc20Token: network.tokens[TokenEnum.BRZ].address,
  } as const;

  const regular = buildOperationScopedPimlicoClients(common);

  return {
    account,
    sponsoredClient: regular.sponsoredClient,
    erc20Client: regular.erc20Client,
    ownerKind,
    network,
    pimlicoClient: regular.pimlicoClient,
  };
};

/**
 * Resolve the counterfactual Kernel account without requiring a bundler or
 * either paymaster policy. Deployment still happens only in the first UserOp.
 */
export const getAaAccountForRuntime = async (
  runtime: AaRuntime,
): Promise<SmartAccount | null> => {
  const ownerKind = getAaOwnerKind(runtime.connectorId);
  if (!ownerKind || !isAaAvailable(runtime.network)) return null;

  const ownerIdentity = getRuntimeOwnerIdentity(runtime, ownerKind);
  if (!ownerIdentity) return null;

  return cachePromise(
    aaAccountCache,
    `${runtime.network.id}:${ownerKind}:${ownerIdentity}`,
    () => createKernelAccount(runtime, ownerKind),
  );
};

/** Full sending rail: needs the bundler and both paymaster policies. */
export const getAaContextForRuntime = async (
  runtime: AaRuntime,
): Promise<AaContext | null> => {
  const ownerKind = getAaOwnerKind(runtime.connectorId);
  const account = await getAaAccountForRuntime(runtime);
  if (!ownerKind || !account) return null;

  return cachePromise(
    aaContextCache,
    `${runtime.network.id}:${ownerKind}:${account.address.toLowerCase()}`,
    () => createContext(runtime, ownerKind, account),
  );
};

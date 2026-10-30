import {
  http,
  type Account,
  type Chain,
  type Transport,
  type WalletClient,
} from 'viem';
import type { SmartAccount } from 'viem/account-abstraction';
import { PASSKEY_CONNECTOR_ID } from '@doiim/passkeys/wagmi';
import { readStoredSession } from '@doiim/passkeys/storage';
import {
  toKernelAccount,
  toKernelPasskeyAccount,
} from '@doiim/passkeys/smart-account';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { prepareUserOperationForErc20Paymaster } from 'permissionless/experimental/pimlico';

import { requireRpId, sponsorshipPolicyId } from '@/config/aa';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { MAGIC_CONNECTOR_ID } from '@/wallet/magic';
import type { AaContext, AaOwnerKind, AaRuntime } from './types';

export const getAaOwnerKind = (connectorId?: string): AaOwnerKind | null => {
  if (connectorId === PASSKEY_CONNECTOR_ID) return 'passkey';
  if (connectorId === MAGIC_CONNECTOR_ID) return 'social';
  return null;
};

/** AA is usable only with a bundler and, on Pimlico, a sponsorship policy. */
export const isAaAvailable = (network: NetworkConfig): boolean => {
  if (!network.aa?.bundlerUrl) return false;
  return Boolean(sponsorshipPolicyId());
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

const getRuntimeOwnerIdentity = (runtime: AaRuntime): string | undefined =>
  runtime.ownerKind === 'passkey'
    ? readStoredSession()?.credentialId
    : runtime.walletClient?.account?.address.toLowerCase();

const createKernelAccount = async (
  runtime: AaRuntime,
): Promise<SmartAccount> => {
  const { publicClient } = runtime;
  if (runtime.ownerKind === 'passkey') {
    const session = readStoredSession();
    if (!session) throw new Error('Passkey session not available');
    const { credentialId, publicKeyX, publicKeyY } = session;
    return toKernelPasskeyAccount({
      client: publicClient,
      credentialId,
      publicKeyX,
      publicKeyY,
      rpId: requireRpId(),
    });
  }

  const owner = runtime.walletClient;
  if (!owner?.account) throw new Error('Social login signer not available');
  return toKernelAccount({
    client: publicClient,
    owner: owner as WalletClient<Transport, Chain | undefined, Account>,
  });
};

/** Sending rail (bundler + both paymasters) for an already-built account. */
export const createAaContext = async (
  { network, publicClient }: Pick<AaRuntime, 'network' | 'publicClient'>,
  account: SmartAccount,
): Promise<AaContext> => {
  const bundlerUrl = network.aa?.bundlerUrl;
  const sponsorshipPolicy = sponsorshipPolicyId();
  // Callers already checked isAaAvailable; this narrows the types.
  if (!bundlerUrl || !sponsorshipPolicy) {
    throw new Error(`AA is not configured for chain ${network.id}`);
  }

  const pimlicoClient = createPimlicoClient({
    chain: network,
    transport: http(bundlerUrl),
    entryPoint: account.entryPoint,
  });
  const base = {
    account,
    chain: network,
    bundlerTransport: http(bundlerUrl),
    client: publicClient,
    paymaster: pimlicoClient,
  };
  const estimateFeesPerGas = async () =>
    (await pimlicoClient.getUserOperationGasPrice()).fast;
  const feeToken = network.aa?.feeToken;

  return {
    account,
    network,
    pimlicoClient,
    selfPayClient: createSmartAccountClient({
      account,
      chain: network,
      bundlerTransport: http(bundlerUrl),
      client: publicClient,
      userOperation: { estimateFeesPerGas },
    }),
    sponsoredClient: createSmartAccountClient({
      ...base,
      paymasterContext: { sponsorshipPolicyId: sponsorshipPolicy },
      userOperation: { estimateFeesPerGas },
    }),
    // Only when the network names a fee token; unset means sponsorship only.
    erc20Client: feeToken
      ? createSmartAccountClient({
          ...base,
          paymasterContext: { token: network.tokens[feeToken].address },
          userOperation: {
            estimateFeesPerGas,
            prepareUserOperation: prepareUserOperationForErc20Paymaster(
              pimlicoClient,
              { balanceOverride: false },
            ),
          },
        })
      : undefined,
  };
};

/**
 * Resolve the counterfactual Kernel account without requiring a bundler or
 * either paymaster policy. Deployment still happens only in the first UserOp.
 */
export const getAaAccountForRuntime = async (
  runtime: AaRuntime,
): Promise<SmartAccount | null> => {
  if (!isAaAvailable(runtime.network)) return null;

  const ownerIdentity = getRuntimeOwnerIdentity(runtime);
  if (!ownerIdentity) return null;

  return cachePromise(
    aaAccountCache,
    `${runtime.network.id}:${runtime.ownerKind}:${ownerIdentity}`,
    () => createKernelAccount(runtime),
  );
};

/** Full sending rail: needs the bundler and both paymaster policies. */
export const getAaContextForRuntime = async (
  runtime: AaRuntime,
): Promise<AaContext | null> => {
  const account = await getAaAccountForRuntime(runtime);
  if (!account) return null;

  return cachePromise(
    aaContextCache,
    `${runtime.network.id}:${runtime.ownerKind}:${account.address.toLowerCase()}`,
    () => createAaContext(runtime, account),
  );
};

import { ref } from 'vue';
import {
  toPasskeyAccount,
  toKernelPasskeyAccount,
  buildBundlerTransport,
  buildPaymasterSetup,
  sweepAll,
  addOwner,
  listOwners,
  listOwnersPublicKeys,
  getTokenBalances,
  type TokenBalance,
  type SweepResult,
  type OwnerPublicKey,
} from '@doiim/passkeys/smart-account';
import type { StoredSession } from '@doiim/passkeys/storage';
import {
  type Address,
  type Hex,
  type PublicClient,
  createPublicClient,
  http,
} from 'viem';
import {
  type BundlerClient,
  createBundlerClient,
} from 'viem/account-abstraction';
import { env } from '@/config/env';
import { useUser } from '@/composables/useUser';

const SESSION_KEY = 'doiim:passkey';

function readStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>;
    if (
      parsed?.credentialId &&
      parsed?.smartAccountAddress &&
      parsed?.publicKeyX &&
      parsed?.publicKeyY &&
      parsed?.salt
    ) {
      return parsed as StoredSession;
    }
    return null;
  } catch {
    return null;
  }
}

let _publicClient: PublicClient | null = null;
let _bundlerClient: BundlerClient | null = null;
let _building = false;

export function usePasskeyAccount() {
  const user = useUser();
  const busy = ref(false);
  const error = ref<string | null>(null);
  const lastUserOpHash = ref<string | null>(null);
  const owners = ref<readonly Address[]>([]);
  const ownersPublicKeys = ref<readonly OwnerPublicKey[]>([]);
  const balances = ref<TokenBalance[]>([]);
  const ethBalance = ref<bigint>(0n);

  const accountKind = env.passkey.accountKind;
  const pluginAddress = env.passkey.webauthnPluginAddress;
  const entryPointAddress = env.passkey.entryPointAddress;
  const factoryAddress = env.passkey.factoryAddress;
  const bundlerApiKey = env.passkey.pimlicoApiKey;
  const bundlerUrl = env.passkey.bundlerUrl;
  const sponsorshipPolicyId = env.passkey.sponsorshipPolicyId;

  const isReady =
    accountKind === 'kernel'
      ? Boolean(bundlerApiKey || bundlerUrl)
      : Boolean(pluginAddress) &&
        Boolean(entryPointAddress) &&
        Boolean(factoryAddress) &&
        Boolean(bundlerApiKey || bundlerUrl);

  const getPublicClient = (): PublicClient => {
    if (_publicClient) return _publicClient;
    const chain = user.network.value;
    let rpcUrl = 'http://127.0.0.1:8545';

    if (
      chain.rpcUrls?.default?.http?.[0] &&
      chain.rpcUrls.default.http[0] !== ''
    ) {
      rpcUrl = chain.rpcUrls.default.http[0];
    }
    _publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    return _publicClient;
  };

  const getBundlerClient = async (): Promise<BundlerClient | null> => {
    if (_bundlerClient) return _bundlerClient;
    if (_building) return null;

    const session = readStoredSession();
    if (!session) return null;
    if (!isReady) return null;

    _building = true;
    try {
      const chain = user.network.value;
      const pc = getPublicClient();

      const account =
        accountKind === 'kernel'
          ? await toKernelPasskeyAccount({
              client: pc,
              credentialId: session.credentialId,
              publicKeyX: session.publicKeyX as Hex,
              publicKeyY: session.publicKeyY as Hex,
              entryPointAddress,
            })
          : await toPasskeyAccount({
              client: pc,
              credentialId: session.credentialId,
              publicKeyX: session.publicKeyX as Hex,
              publicKeyY: session.publicKeyY as Hex,
              address: session.smartAccountAddress,
              factoryAddress: factoryAddress!,
              entryPointAddress: entryPointAddress!,
              salt: session.salt as Hex,
            });

      const bundlerCfg = {
        chainId: chain.id,
        entryPointAddress: account.entryPoint.address,
        publicClient: pc,
        bundlerApiKey,
        bundlerUrl,
        sponsorshipPolicyId,
      };

      _bundlerClient = createBundlerClient({
        account,
        client: pc,
        transport: buildBundlerTransport(bundlerCfg),
        ...buildPaymasterSetup(bundlerCfg),
      });
      return _bundlerClient;
    } catch (e) {
      error.value =
        e instanceof Error ? e.message : 'Failed to build bundler client';
      return null;
    } finally {
      _building = false;
    }
  };

  const refreshBalances = async (tokenAddresses: Address[]): Promise<void> => {
    const session = readStoredSession();
    if (!session) return;
    const pc = getPublicClient();
    try {
      const result = await getTokenBalances(
        pc,
        session.smartAccountAddress,
        tokenAddresses,
      );
      ethBalance.value = result.eth;
      balances.value = result.tokens;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to fetch balances';
    }
  };

  const refreshOwners = async (): Promise<void> => {
    if (!pluginAddress) return;
    const session = readStoredSession();
    if (!session) return;
    const pc = getPublicClient();
    try {
      const [eoaOwners, pkOwners] = await Promise.all([
        listOwners(pc, pluginAddress, session.smartAccountAddress),
        listOwnersPublicKeys(pc, pluginAddress, session.smartAccountAddress),
      ]);
      owners.value = eoaOwners;
      ownersPublicKeys.value = pkOwners;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to list owners';
    }
  };

  const sweep = async (
    tokenAddresses: Address[],
    recipient: Address,
  ): Promise<SweepResult | null> => {
    busy.value = true;
    error.value = null;
    lastUserOpHash.value = null;
    try {
      const client = await getBundlerClient();
      if (!client) throw new Error('Bundler client not available');
      const result = await sweepAll(client, tokenAddresses, recipient);
      lastUserOpHash.value = result.userOpHash;
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Sweep failed';
      return null;
    } finally {
      busy.value = false;
    }
  };

  const addRecoveryOwner = async (
    eoaAddress: Address,
  ): Promise<string | null> => {
    busy.value = true;
    error.value = null;
    lastUserOpHash.value = null;
    try {
      const client = await getBundlerClient();
      if (!client) throw new Error('Bundler client not available');
      if (!pluginAddress) {
        throw new Error(
          accountKind === 'kernel'
            ? 'Adding a recovery owner is not supported in kernel mode yet'
            : 'Plugin address not configured',
        );
      }
      const userOpHash = await addOwner(client, pluginAddress, eoaAddress);
      lastUserOpHash.value = userOpHash;
      return userOpHash;
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Add owner failed';
      return null;
    } finally {
      busy.value = false;
    }
  };

  const session = readStoredSession();
  const smartAccountAddress: Address | null =
    session?.smartAccountAddress ?? null;

  return {
    busy,
    error,
    lastUserOpHash,
    owners,
    ownersPublicKeys,
    balances,
    ethBalance,
    smartAccountAddress,
    isReady,
    sweep,
    addRecoveryOwner,
    refreshBalances,
    refreshOwners,
    readStoredSession,
  };
}

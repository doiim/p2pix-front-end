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
import {
  type Address,
  type Hex,
  type Chain,
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
import { getActiveAaContext, readPasskeySession } from '@/blockchain/aaAccount';
import { getErrorMessage } from '@/utils/error';

let _publicClient: PublicClient | null = null;
let _publicClientChainId: number | null = null;
let _bundlerClient: BundlerClient | null = null;
let _building = false;
const passkeyIsLocal = Boolean(env.local.p2pix);
const passkeyAccountKind: 'kernel' | 'exactly-mode' = passkeyIsLocal
  ? env.passkey.accountKind
  : 'kernel';

const resolvePasskeyChain = (activeNetwork: Chain): Chain => activeNetwork;
const resolvePasskeyRpcUrl = (activeNetwork: Chain): string =>
  activeNetwork.rpcUrls.default.http[0];

/**
 * `sweepAll` transfers each requested token's full balance. The Pimlico fee
 * token must retain the quoted maximum until postOp, so sweeping it is unsafe.
 */
export const assertSweepPreservesPaymasterFeeToken = (
  tokenAddresses: readonly Address[],
  paymasterToken?: Address,
): void => {
  if (
    paymasterToken &&
    tokenAddresses.some(
      (token) => token.toLowerCase() === paymasterToken.toLowerCase(),
    )
  ) {
    throw new Error(
      'Cannot sweep the ERC-20 paymaster fee token because its balance must cover UserOperation gas',
    );
  }
};

export function usePasskeyAccount() {
  const user = useUser();
  const busy = ref(false);
  const error = ref<string | null>(null);
  const lastUserOpHash = ref<string | null>(null);
  const owners = ref<readonly Address[]>([]);
  const ownersPublicKeys = ref<readonly OwnerPublicKey[]>([]);
  const balances = ref<TokenBalance[]>([]);
  const ethBalance = ref<bigint>(0n);

  // Read the passkey chain/mode from the single source of truth (config/passkey)
  // so account operations here target the SAME chain + kind the connector used
  // to derive the account. In kernel mode the exactly-mode plugin/factory and
  // the local EntryPoint don't apply — drop them so they can't be misused.
  const accountKind = passkeyAccountKind;
  const pluginAddress =
    accountKind === 'kernel' ? undefined : env.passkey.webauthnPluginAddress;
  const entryPointAddress = passkeyIsLocal
    ? env.passkey.entryPointAddress
    : undefined;
  const factoryAddress =
    accountKind === 'kernel' ? undefined : env.passkey.factoryAddress;
  const bundlerApiKey = env.passkey.pimlicoApiKey;
  const bundlerUrl = env.passkey.bundlerUrl;
  const sponsorshipPolicyId = env.passkey.sponsorshipPolicyId;

  const activeAa = user.network.value.aa;
  const isReady = !passkeyIsLocal
    ? Boolean(activeAa && (bundlerApiKey || activeAa.bundlerUrl || bundlerUrl))
    : accountKind === 'kernel'
      ? Boolean(bundlerApiKey || bundlerUrl)
      : Boolean(pluginAddress) &&
        Boolean(entryPointAddress) &&
        Boolean(factoryAddress) &&
        Boolean(bundlerApiKey || bundlerUrl);

  const getPublicClient = (): PublicClient => {
    if (!passkeyIsLocal) {
      const chain = resolvePasskeyChain(user.network.value);
      if (_publicClient && _publicClientChainId === chain.id)
        return _publicClient;
      _publicClient = createPublicClient({
        chain,
        transport: http(resolvePasskeyRpcUrl(chain)),
      });
      _publicClientChainId = chain.id;
      return _publicClient;
    }

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
    if (!passkeyIsLocal) {
      const context = await getActiveAaContext();
      return (context?.erc20Client as unknown as BundlerClient) ?? null;
    }
    if (_bundlerClient) return _bundlerClient;
    if (_building) return null;

    const session = readPasskeySession();
    if (!session) return null;
    if (!isReady) return null;

    _building = true;
    try {
      const chainId = user.network.value.id;
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
        chainId,
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
      error.value = getErrorMessage(e, 'Failed to build bundler client');
      return null;
    } finally {
      _building = false;
    }
  };

  const refreshBalances = async (tokenAddresses: Address[]): Promise<void> => {
    const session = readPasskeySession();
    const context = passkeyIsLocal ? null : await getActiveAaContext();
    const address = context?.account.address ?? session?.smartAccountAddress;
    if (!address) return;
    const pc = getPublicClient();
    try {
      const result = await getTokenBalances(pc, address, tokenAddresses);
      ethBalance.value = result.eth;
      balances.value = result.tokens;
    } catch (e) {
      error.value = getErrorMessage(e, 'Failed to fetch balances');
    }
  };

  const refreshOwners = async (): Promise<void> => {
    if (!pluginAddress) return;
    const session = readPasskeySession();
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
      error.value = getErrorMessage(e, 'Failed to list owners');
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
      let bundlerClient: BundlerClient | null;
      if (!passkeyIsLocal) {
        const context = await getActiveAaContext();
        if (!context) throw new Error('AA context not available');
        assertSweepPreservesPaymasterFeeToken(
          tokenAddresses,
          context.network.aa?.paymasterPolicies.paidOperations?.token,
        );
        // The default client has balanceOverride=false and therefore simulates
        // against the real token balance. Incoming-balance override is release-only.
        bundlerClient = context.erc20Client as unknown as BundlerClient;
      } else {
        bundlerClient = await getBundlerClient();
      }
      if (!bundlerClient) throw new Error('Bundler client not available');
      const result = await sweepAll(bundlerClient, tokenAddresses, recipient);
      lastUserOpHash.value = result.userOpHash;
      return result;
    } catch (e) {
      error.value = getErrorMessage(e, 'Sweep failed');
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
      const bundlerClient = await getBundlerClient();
      if (!bundlerClient) throw new Error('Bundler client not available');
      if (!pluginAddress) {
        throw new Error(
          accountKind === 'kernel'
            ? 'Adding a recovery owner is not supported in kernel mode yet'
            : 'Plugin address not configured',
        );
      }
      const userOpHash = await addOwner(
        bundlerClient,
        pluginAddress,
        eoaAddress,
      );
      lastUserOpHash.value = userOpHash;
      return userOpHash;
    } catch (e) {
      error.value = getErrorMessage(e, 'Add owner failed');
      return null;
    } finally {
      busy.value = false;
    }
  };

  const session = readPasskeySession();
  const smartAccountAddress: Address | null =
    session?.smartAccountAddress ?? user.walletAddress.value;

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
    readStoredSession: readPasskeySession,
  };
}

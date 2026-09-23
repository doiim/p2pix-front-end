// `@doiim/reown-appkit*` are the doiim fork of `@reown/appkit*`, published
// to the public npm registry under the `@doiim/*` scope. Fork bakes
// connectMethods, theme, passkey connector, and applies its defaults below;
// consumer options here win. See README.md → "Reown AppKit (doiim fork)".
import { createAppKit } from '@doiim/reown-appkit/vue';
import { WagmiAdapter } from '@doiim/reown-appkit-adapter-wagmi';
import {
  ChainController,
  ConnectionController,
  OptionsController,
} from '@doiim/reown-appkit-controllers';
import type { ConnectMethod } from '@doiim/reown-appkit-controllers';

import { DEFAULT_NETWORK, wagmiNetworks } from '@/config/networks';
import {
  isAaAvailable,
  rpId,
  sponsorshipPolicyId as configuredSponsorshipPolicyId,
} from '@/config/aa';
import type { NetworkConfig } from '@/model/NetworkEnum';

let _adapter: WagmiAdapter | undefined;
let _reownEoaMigration: Promise<'eoa'> | undefined;

const reownProjectId = (
  import.meta.env.VITE_REOWN_PROJECT_ID as string | undefined
)?.trim();
if (!reownProjectId) {
  throw new Error('[env] missing VITE_REOWN_PROJECT_ID');
}

export type ReownEip155AccountType = 'eoa' | 'smartAccount';

// The passkey CTA is a login rail for Kernel accounts: it must only be offered
// on chains that actually have an AA rail. We toggle it through the fork's
// `connectMethodsOrder` (WalletUtil honours it) instead of unregistering the
// connector, so switching back to an AA chain restores it with no adapter
// rebuild and one shared session.
const CONNECT_METHODS_WITH_PASSKEY: ConnectMethod[] = [
  'email',
  'passkey',
  'social',
  'wallet',
];
const CONNECT_METHODS_WITHOUT_PASSKEY: ConnectMethod[] = [
  'email',
  'social',
  'wallet',
];

/** Offer "Continue with Passkey" only while the selected chain has an AA rail. */
export const syncPasskeyAvailability = (
  network: NetworkConfig | undefined,
): void => {
  OptionsController.setFeatures({
    connectMethodsOrder: isAaAvailable(network)
      ? CONNECT_METHODS_WITH_PASSKEY
      : CONNECT_METHODS_WITHOUT_PASSKEY,
  });
};

/** Address Reown currently exposes for eip155, whatever its account type. */
export const getReownEip155Address = (): string | undefined =>
  ChainController.getAccountData('eip155')?.address;

export const getReownEip155AccountType = ():
  | ReownEip155AccountType
  | undefined => {
  const accountType =
    ChainController.getAccountData('eip155')?.preferredAccountType;
  return accountType === 'eoa' || accountType === 'smartAccount'
    ? accountType
    : undefined;
};

/**
 * AUTH can persist a Reown-managed smart account even though new sessions
 * default to EOA. Kernel needs the underlying EOA as its ECDSA owner.
 */
export const ensureReownEoaAccount = async (): Promise<'eoa'> => {
  if (getReownEip155AccountType() === 'eoa') return 'eoa';

  const migration = (_reownEoaMigration ??= (async (): Promise<'eoa'> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error('Reown AUTH migration timeout (10s)')),
        10000,
      );
    });

    try {
      await Promise.race([
        ConnectionController.setPreferredAccountType('eoa', 'eip155'),
        timeoutPromise,
      ]);
    } finally {
      clearTimeout(timer);
    }

    if (getReownEip155AccountType() !== 'eoa') {
      throw new Error(
        'Reown AUTH must expose an EOA account before it can own a Kernel account',
      );
    }

    return 'eoa';
  })());

  try {
    return await migration;
  } finally {
    // Only the in-flight migration is shared. Clear the module slot only if it
    // still points at this same promise — otherwise a later caller has already
    // started its own migration and wiping the slot would break the dedup and
    // allow a duplicate setPreferredAccountType round-trip. Reown can switch
    // the preferred account type back at any time, so a resolved result must
    // never be replayed as proof that the account is still an EOA.
    if (_reownEoaMigration === migration) {
      _reownEoaMigration = undefined;
    }
  }
};

export const setupAppKit = (): WagmiAdapter => {
  if (_adapter) return _adapter;

  const defaultNetwork = DEFAULT_NETWORK;
  const defaultPasskeyRpcUrl = defaultNetwork.rpcUrls?.default?.http?.[0];
  // The default network's per-chain AA config drives the passkey connector.
  const defaultAa = defaultNetwork.aa;

  // Sponsorship policy comes from env; the bundler URL comes from the chain.
  const sponsorshipPolicyId = configuredSponsorshipPolicyId();

  // Shared with the app's AA rail (config/networks.ts) so both gates agree.
  const finalBundlerUrl = defaultAa?.bundlerUrl;

  // Every passkey uses the same Kernel v0.3.1 / EntryPoint v0.7 account rail.
  // `rpcUrl` keeps custom local chains on the connector's inline-client path.
  // Without a bundler the connector throws on construction, which would take
  // down social/e-mail login too — disable passkeys instead. The sponsorship
  // policy is required too: a passkey account has no EOA to fall back to, so
  // enabling the connector while isAaAvailable() is false only produces a
  // login that cannot transact.
  const passkeyConfig =
    finalBundlerUrl && sponsorshipPolicyId
      ? {
          rpId,
          rpName: 'P2Pix',
          accountKind: 'kernel' as const,
          chainId: Number(defaultNetwork.id),
          rpcUrl: defaultPasskeyRpcUrl,
          bundlerUrl: finalBundlerUrl,
          sponsorshipPolicyId: sponsorshipPolicyId,
        }
      : undefined;
  if (!passkeyConfig) {
    console.warn(
      '[passkey] network.aa.bundlerUrl / VITE_PIMLICO_SPONSORSHIP_POLICY_ID not set; passkey login disabled',
    );
  }

  const adapter = new WagmiAdapter({
    networks: wagmiNetworks,
    projectId: reownProjectId,
    passkey: passkeyConfig,
  });

  createAppKit({
    adapters: [adapter],
    networks: wagmiNetworks,
    defaultNetwork,
    projectId: reownProjectId,
    metadata: {
      name: 'P2Pix',
      description: 'P2P token exchange via Pix',
      icons: ['/p2pix.svg'],
      // url defaults to window.location.origin (fork-side; see
      // applyDoiimDefaults in @doiim/reown-appkit).
      url: '',
    },
    features: {
      email: true,
      emailShowWallets: true,
      swaps: false,
      onramp: false,
    },
    themeMode: 'light',
    // Social/e-mail login supplies an EOA signer. The app wraps that owner in
    // the same Kernel/Pimlico stack used by passkeys.
    defaultAccountTypes: { eip155: 'eoa' },
  });

  _adapter = adapter;
  // Apply the initial gate: the modal can be opened before TopBar mounts.
  syncPasskeyAvailability(defaultNetwork);
  return adapter;
};

export const getWagmiConfig = () => {
  if (!_adapter) {
    throw new Error(
      '[appkit] getWagmiConfig() called before setupAppKit(). ' +
        'Make sure src/main.ts calls setupAppKit() before mounting the app.',
    );
  }
  return _adapter.wagmiConfig;
};

// ---------------------------------------------------------------------------
// Wallet composables — thin wrappers around Reown's Vue composables.
// The rest of the app imports these from @/config/appkit instead of
// @doiim/reown-appkit/vue so the wallet provider is swappable.
// ---------------------------------------------------------------------------
export { useAppKit as useWalletModal } from '@doiim/reown-appkit/vue';
export { useAppKitAccount as useWalletAccount } from '@doiim/reown-appkit/vue';
export { useAppKitNetwork as useWalletNetwork } from '@doiim/reown-appkit/vue';
export { useDisconnect as useWalletDisconnect } from '@doiim/reown-appkit/vue';

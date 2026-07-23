// `@doiim/reown-appkit*` are the doiim fork of `@reown/appkit*`, published
// to the public npm registry under the `@doiim/*` scope. Fork bakes
// connectMethods, theme, passkey connector, and applies its defaults below;
// consumer options here win. See README.md → "Reown AppKit (doiim fork)".
import { createAppKit } from '@doiim/reown-appkit/vue';
import { WagmiAdapter } from '@doiim/reown-appkit-adapter-wagmi';
import {
  ChainController,
  ConnectionController,
} from '@doiim/reown-appkit-controllers';

import { buildNetworks } from '@/config/networks';
import type { Env } from '@/config/env';

let _adapter: WagmiAdapter | undefined;
let _reownEoaMigration: Promise<'eoa'> | undefined;

export type ReownEip155AccountType = 'eoa' | 'smartAccount';

/**
 * Read the account type selected by Reown's AUTH connector from AppKit's
 * canonical account state. A viem WalletClient cannot distinguish an EOA from
 * a Reown-managed smart account: both surface as JSON-RPC accounts.
 */
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
 * Migrate persisted AUTH sessions to an EOA before using their WalletClient as
 * a Kernel ECDSA owner. ConnectionController is the supported AppKit path: it
 * updates the provider, reconnects it and persists the new preference.
 */
export const ensureReownEoaAccount = async (): Promise<'eoa'> => {
  if (getReownEip155AccountType() === 'eoa') return 'eoa';

  const migration = (_reownEoaMigration ??= (async (): Promise<'eoa'> => {
    await ConnectionController.setPreferredAccountType('eoa', 'eip155');

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
    _reownEoaMigration = undefined;
  }
};

export const setupAppKit = (env: Env): WagmiAdapter => {
  if (_adapter) return _adapter;

  const { wagmiNetworks, defaultNetwork } = buildNetworks(env);
  const passkeyIsLocal = Boolean(env.local.p2pix);
  const passkeyAccountKind = passkeyIsLocal
    ? env.passkey.accountKind
    : 'kernel';
  const defaultPasskeyRpcUrl = defaultNetwork.rpcUrls?.default?.http?.[0];

  // The connector's PasskeyConnectorConfig names the Pimlico key
  // `bundlerApiKey`; env.passkey exposes it as `pimlicoApiKey`. Without this
  // remap the key never reaches the connector, and kernel mode throws
  // PasskeyConfigError ("bundlerApiKey (or bundlerUrl) is required").
  //
  // `rpcUrl` is always supplied so the connector uses its inline-client path
  // instead of wagmi's getClient resolver — that resolver returns no client in
  // the bundled build ("no public client available for chainId ...").
  //
  // Off local dev the passkey account starts on AppKit's active/default trading
  // chain in kernel mode (see config/passkey.ts), so no
  // custom plugin/factory/EntryPoint is needed, and any exactly-mode / local
  // addresses from env are dropped so they can't leak into the kernel account
  // derivation (kernel uses the canonical EntryPoint 0.7).
  const passkeyConfig = passkeyIsLocal
    ? {
        ...env.passkey,
        bundlerApiKey: env.passkey.pimlicoApiKey,
        rpName: 'P2Pix',
        chainId: Number(defaultNetwork.id),
        rpcUrl:
          env.passkey.rpcUrl ||
          defaultNetwork.rpcUrls?.default?.http?.[0] ||
          undefined,
      }
    : {
        ...env.passkey,
        bundlerApiKey: env.passkey.pimlicoApiKey,
        rpName: 'P2Pix',
        accountKind: passkeyAccountKind,
        chainId: Number(defaultNetwork.id),
        rpcUrl: defaultPasskeyRpcUrl,
        entryPointAddress: undefined,
        webauthnPluginAddress: undefined,
        factoryAddress: undefined,
      };

  const adapter = new WagmiAdapter({
    networks: wagmiNetworks,
    projectId: env.reownProjectId,
    passkey: passkeyConfig,
  });

  createAppKit({
    adapters: [adapter],
    networks: wagmiNetworks,
    defaultNetwork: defaultNetwork as any,
    projectId: env.reownProjectId,
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
  return adapter;
};

export const getWagmiConfig = () => {
  if (!_adapter) {
    throw new Error(
      '[appkit] getWagmiConfig() called before setupAppKit(). ' +
        'Make sure src/main.ts calls setupAppKit(env) before mounting the app.',
    );
  }
  return _adapter.wagmiConfig;
};

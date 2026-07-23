// `@doiim/reown-appkit*` are the doiim fork of `@reown/appkit*`, published
// to the public npm registry under the `@doiim/*` scope. Fork bakes
// connectMethods, theme, passkey connector, and applies its defaults below;
// consumer options here win. See README.md → "Reown AppKit (doiim fork)".
import { createAppKit } from '@doiim/reown-appkit/vue';
import { WagmiAdapter } from '@doiim/reown-appkit-adapter-wagmi';

import { buildNetworks } from '@/config/networks';
import type { Env } from '@/config/env';
import {
  passkeyIsLocal,
  passkeyChain,
  passkeyRpcUrl,
  passkeyAccountKind,
} from '@/config/passkey';

let _adapter: WagmiAdapter | undefined;

export const setupAppKit = (env: Env): WagmiAdapter => {
  if (_adapter) return _adapter;

  const { wagmiNetworks, defaultNetwork } = buildNetworks(env);

  // The connector's PasskeyConnectorConfig names the Pimlico key
  // `bundlerApiKey`; env.passkey exposes it as `pimlicoApiKey`. Without this
  // remap the key never reaches the connector, and kernel mode throws
  // PasskeyConfigError ("bundlerApiKey (or bundlerUrl) is required").
  //
  // `rpcUrl` is always supplied so the connector uses its inline-client path
  // instead of wagmi's getClient resolver — that resolver returns no client in
  // the bundled build ("no public client available for chainId ...").
  //
  // Off local dev the passkey account runs on Arbitrum One in kernel mode (see
  // config/passkey.ts): the Kernel factory is already deployed there so no
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
        chainId: Number(passkeyChain.id),
        rpcUrl: passkeyRpcUrl,
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

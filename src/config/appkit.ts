// `@doiim/reown-appkit*` are the doiim fork of `@reown/appkit*`, published
// to the public npm registry under the `@doiim/*` scope. Fork bakes
// connectMethods, theme, passkey connector, and applies its defaults below;
// consumer options here win. See README.md → "Reown AppKit (doiim fork)".
import { createAppKit } from '@doiim/reown-appkit/vue';
import { WagmiAdapter } from '@doiim/reown-appkit-adapter-wagmi';

import { buildNetworks } from '@/config/networks';
import type { Env } from '@/config/env';

let _adapter: WagmiAdapter | undefined;

export const setupAppKit = (env: Env): WagmiAdapter => {
  if (_adapter) return _adapter;

  const { wagmiNetworks, defaultNetwork } = buildNetworks(env);

  const adapter = new WagmiAdapter({
    networks: wagmiNetworks,
    projectId: env.reownProjectId,
    passkey: {
      ...env.passkey,
      // The connector's PasskeyConnectorConfig names the Pimlico key
      // `bundlerApiKey`; env.passkey exposes it as `pimlicoApiKey`. Without
      // this remap the key never reaches the connector, and kernel mode
      // throws PasskeyConfigError ("bundlerApiKey (or bundlerUrl) is required").
      bundlerApiKey: env.passkey.pimlicoApiKey,
      rpName: 'P2Pix',
      chainId: Number(defaultNetwork.id),
    },
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

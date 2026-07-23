// `@reown/appkit*` resolve to the doiim fork (vendor/reown-appkit/.pack/*.tgz),
// not upstream. Fork bakes connectMethods, theme, passkey connector, and
// applies its defaults below; consumer options here win. See README.md →
// "Reown AppKit (doiim fork)" for the rebuild workflow.
import { createAppKit } from '@reown/appkit/vue';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';

import { buildNetworks } from '@/config/networks';
import type { Env } from '@/config/env';

let _adapter: WagmiAdapter | undefined;

export const setupAppKit = (env: Env): WagmiAdapter => {
  if (_adapter) return _adapter;

  const { wagmiNetworks, defaultNetwork } = buildNetworks(env);

  // Defense-in-depth: if the deployed factory address changed since the last
  // run (e.g. a fresh anvil deploy), the cached passkey session in localStorage
  // will hold a now-invalid smart-account address. Detect that and clear it
  // proactively so the user gets a clean re-derive on next connect.
  if (typeof window !== 'undefined' && env.passkey.factoryAddress) {
    const FACTORY_KEY = 'doiim:passkey:factory';
    const lastFactory = window.localStorage.getItem(FACTORY_KEY);
    if (
      lastFactory &&
      lastFactory.toLowerCase() !== env.passkey.factoryAddress.toLowerCase()
    ) {
      console.log('[passkey] factory address changed, clearing stale session', {
        previous: lastFactory,
        current: env.passkey.factoryAddress,
      });
      window.localStorage.removeItem('doiim:passkey');
    }
    window.localStorage.setItem(FACTORY_KEY, env.passkey.factoryAddress);
  }

  const adapter = new WagmiAdapter({
    networks: wagmiNetworks,
    projectId: env.reownProjectId,
    passkey: {
      ...env.passkey,
      rpName: 'P2Pix',
      chainId: Number(defaultNetwork.id),
    },
  });

  createAppKit({
    adapters: [adapter],
    networks: wagmiNetworks,
    defaultNetwork,
    projectId: env.reownProjectId,
    metadata: {
      name: 'P2Pix',
      description: 'P2P token exchange via Pix',
      icons: ['/p2pix.svg'],
      // url defaults to window.location.origin (fork-side; see
      // applyDoiimDefaults in @reown/appkit).
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

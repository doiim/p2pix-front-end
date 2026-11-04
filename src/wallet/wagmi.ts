import type { Chain } from 'viem';
import {
  createConfig,
  connect,
  http,
  injected,
  type Connector,
} from '@wagmi/core';

import { PASSKEY_CONNECTOR_ID, passkeyConnector } from '@doiim/passkeys/wagmi';

import { env, PASSKEY_SHARED_SUFFIXES, rpId } from '@/config/aa';
import { DEFAULT_NETWORK, Networks } from '@/config/networks';
import { isAaAvailable } from '@/blockchain/aa/aaContext';
import { useUser } from '@/composables/useUser';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { walletConnectConnector } from '@/wallet/walletConnect';
import {
  MAGIC_CONNECTOR_ID,
  completeOAuthRedirect,
  isMagicEnabled,
  magicConnector,
} from '@/wallet/magic';

const buildPasskeyConfig = () => {
  // The bundler URL comes from the chain; the sponsorship policy from env. A
  // passkey account has no EOA to fall back to, so without both the login
  // could not transact — disable passkeys instead. No rpId means the page is
  // not on an owned origin (e.g. a shared IPFS gateway): passkeys stay off.
  if (rpId && isAaAvailable(DEFAULT_NETWORK)) {
    return {
      chainId: DEFAULT_NETWORK.id,
      rpId,
      sharedSuffixes: PASSKEY_SHARED_SUFFIXES,
      isChainSupported: (c: Chain) => isAaAvailable(c as NetworkConfig),
      rpName: 'P2Pix',
      userName: 'P2Pix',
      displayName: 'Conta P2Pix',
    };
  }
  if (!rpId) {
    console.warn(
      '[passkey] origin is not an owned rpId; passkey login disabled',
    );
    return undefined;
  }
  console.warn(
    '[passkey] network.aa.bundlerUrl / VITE_PIMLICO_SPONSORSHIP_POLICY_ID not set; passkey login disabled',
  );
  return undefined;
};

const buildWalletConnect = () => {
  const projectId = env('VITE_WALLETCONNECT_PROJECT_ID');
  if (!projectId) {
    console.warn(
      '[walletconnect] VITE_WALLETCONNECT_PROJECT_ID not set; WalletConnect disabled',
    );
    return [];
  }
  return [
    walletConnectConnector({
      projectId,
      metadata: {
        name: 'P2Pix',
        description: 'Troca P2P de tokens via Pix',
        url: window.location.origin,
        icons: [new URL('p2pix.svg', document.baseURI).href],
      },
    }),
  ];
};

const passkeyConfig = buildPasskeyConfig();

/**
 * Passkey login is a Kernel-account rail, so it is offered only while the
 * app-selected chain has an AA rail. The connector is built once, for
 * `DEFAULT_NETWORK`, and keeps serving that chain whatever the app selects, so
 * the selection has to be read from the app state — one definition serves both
 * gates: the connect modal hides the CTA with it, the guard below refuses
 * `connect()`.
 */
export const isPasskeyAvailable = (): boolean =>
  isAaAvailable(useUser().network.value);

/**
 * Mutable view of a wagmi connector for instance patching: wagmi declares
 * `connect` readonly, and the signature is generic over capabilities, neither
 * of which matters once we only forward the call.
 */
type MutableConnector = {
  connect: (...args: unknown[]) => Promise<unknown>;
};

/**
 * Hard gate: refuse a passkey connection while the selected chain has no AA
 * rail. Hiding the CTA is not enough — the connector stays registered, and
 * `isAuthorized()` keeps returning true while the stored session exists, so a
 * programmatic `connect()`, or wagmi's own reconnect on mount, would still
 * bring up a Kernel account on a chain where the app can display it but never
 * transact with it.
 *
 * `connectors` is `wagmiConfig.connectors`: the instances `useConnect()` and
 * `reconnect()` reach, so one patch covers the modal CTA, the mount-time
 * reconnect and app code alike. Call it only when the passkey rail is
 * configured; a missing connector then means the library renamed it, and the
 * gate must not disappear silently.
 */
export const guardPasskeyConnector = (
  connectors: readonly Connector[],
): void => {
  const connector = connectors.find((c) => c.id === PASSKEY_CONNECTOR_ID);
  if (!connector) {
    throw new Error(
      `[passkey] no connector "${PASSKEY_CONNECTOR_ID}" registered; the passkey rail would be unguarded`,
    );
  }

  // `connect` is readonly and generic on wagmi's Connector, while the runtime
  // object is a plain literal: this hand-checked view is the only way to wrap
  // it. `original` keeps the real function to forward the call to.
  const patchable = connector as unknown as MutableConnector;
  const original = patchable.connect;
  patchable.connect = async (...args: unknown[]): Promise<unknown> => {
    if (!isPasskeyAvailable()) {
      throw new Error(
        `[passkey] chain ${useUser().network.value.id} has no AA rail; refusing to connect`,
      );
    }
    const selected = useUser().network.value.id;
    const result = (await original.apply(connector, args)) as {
      chainId: number;
    };
    if (result.chainId === selected) return result;
    // The connector is built for DEFAULT_NETWORK; follow the chain the user
    // picked instead of dragging the app back to the default.
    await connector.switchChain?.({ chainId: selected });
    return { ...result, chainId: selected };
  };
};

const passkey = passkeyConfig ? passkeyConnector(passkeyConfig) : undefined;

export const wagmiConfig = createConfig({
  chains: Networks,
  transports: Object.fromEntries(
    Networks.map((c) => [
      c.id,
      http(c.rpcUrls.default.http[0], { batch: true }),
    ]),
  ),
  // Concurrent contract reads collapse into one Multicall3 eth_call; a chain
  // without multicall3 in its definition reads one call at a time.
  batch: { multicall: true },
  connectors: [
    injected(),
    ...buildWalletConnect(),
    ...(passkey ? [passkey] : []),
    ...(isMagicEnabled ? [magicConnector()] : []),
  ],
});

// Before anything can call `connect()`: the WagmiPlugin reconnects on mount,
// and a stored passkey session makes the connector authorized.
if (passkey) guardPasskeyConnector(wagmiConfig.connectors);

const isBusy = (status: string) =>
  status === 'reconnecting' || status === 'connecting';

const RECONNECT_WAIT_MS = 10_000;

// The mount-time reconnect rebuilds the connection map when it ends; a connect
// made while it runs can be dropped by it. A stalled reconnect (dead relay,
// unreachable Magic iframe) must not strand callers: after a bounded wait we
// proceed, and the call that follows surfaces its own failure where the user
// can act on it. The late timer is a no-op — stop() and resolve() are both
// idempotent.
export const reconnectSettled = () =>
  new Promise<void>((resolve) => {
    if (!isBusy(wagmiConfig.state.status)) return resolve();
    const stop = wagmiConfig.subscribe(
      (state) => state.status,
      (status) => {
        if (isBusy(status)) return;
        stop();
        resolve();
      },
    );
    setTimeout(() => {
      stop();
      resolve();
    }, RECONNECT_WAIT_MS);
  });

// Back from Google OAuth: finish the Magic login, then expose it to wagmi.
void completeOAuthRedirect()
  .then(async (done) => {
    const connector = wagmiConfig.connectors.find(
      (c) => c.id === MAGIC_CONNECTOR_ID,
    );
    if (!done || !connector) return;
    await reconnectSettled();
    await connect(wagmiConfig, { connector });
  })
  .catch((error) => console.error('[magic] OAuth redirect failed', error));

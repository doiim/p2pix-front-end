import { createConnector } from '@wagmi/core';
import type UniversalProvider from '@walletconnect/universal-provider';
import { getAddress, numberToHex, type Address } from 'viem';

export const WALLETCONNECT_ID = 'walletConnect';
const SESSION_KEY = 'walletConnect.session';

const METHODS = [
  'eth_sendTransaction',
  'personal_sign',
  'eth_signTypedData',
  'eth_signTypedData_v4',
  'wallet_switchEthereumChain',
  'wallet_addEthereumChain',
];
const EVENTS = ['chainChanged', 'accountsChanged'];

type Metadata = {
  name: string;
  description: string;
  url: string;
  icons: string[];
};

// CAIP-10 "eip155:<chain>:<address>" entries of the live session
function sessionAccounts(provider: UniversalProvider) {
  const raw = provider.session?.namespaces.eip155?.accounts ?? [];
  return raw.map((a) => {
    const [, chain, address] = a.split(':');
    return { chainId: Number(chain), address: getAddress(address) };
  });
}

// Own wagmi connector on @walletconnect/universal-provider. The relay
// websocket is opened only when the provider is created: on a user click, or
// on reload when a session marker exists — never for a first-time visitor.
export function walletConnectConnector(params: {
  projectId: string;
  metadata: Metadata;
}) {
  type Storage = { [SESSION_KEY]: boolean };
  return createConnector<UniversalProvider, Record<string, unknown>, Storage>(
    (config) => {
      let provider: Promise<UniversalProvider> | undefined;
      let chainId: number | undefined;
      // bumped when a pairing is abandoned; a late approval then tears itself down
      let attempt = 0;

      const rpcMap = Object.fromEntries(
        config.chains.map((c) => [c.id, c.rpcUrls.default.http[0]]),
      );
      const caip = (id: number) => `eip155:${id}`;
      // the wallet may default a new session to another approved chain:
      // keep the user's pick when the session covers it
      const keepChain = (p: UniversalProvider, id: number) => {
        if (sessionAccounts(p).some((a) => a.chainId === id))
          p.setDefaultChain(caip(id), rpcMap[id]);
      };

      const onAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) return void onDisconnect();
        config.emitter.emit('change', {
          accounts: accounts.map((a) => getAddress(a)),
        });
      };
      const onChainChanged = (id: string | number) => {
        chainId = Number(id);
        config.emitter.emit('change', { chainId });
      };
      const onDisconnect = () => {
        chainId = undefined;
        void config.storage?.removeItem(SESSION_KEY);
        config.emitter.emit('disconnect');
      };

      const create = async () => {
        // The relay client is heavy and only matters on a user click or a
        // session restore: fetch it when the provider is actually created,
        // never as part of page load.
        const { default: UniversalProvider } =
          await import('@walletconnect/universal-provider');
        const p = await UniversalProvider.init({
          projectId: params.projectId,
          metadata: params.metadata,
          // @walletconnect/core batches telemetry to pulse.walletconnect.org by default
          telemetryEnabled: false,
        });
        p.on('accountsChanged', onAccountsChanged);
        p.on('chainChanged', onChainChanged);
        p.on('session_delete', onDisconnect);
        p.on('disconnect', onDisconnect);
        return p;
      };

      return {
        id: WALLETCONNECT_ID,
        name: 'WalletConnect',
        type: 'walletConnect',

        async getProvider() {
          if (!provider) {
            const entry = create();
            provider = entry;
            // don't cache a failed init; let the next call retry
            entry.catch(() => {
              if (provider === entry) provider = undefined;
            });
          }
          return provider;
        },
        async connect(opts) {
          const p = await this.getProvider();
          const wanted = opts?.chainId ?? config.chains[0].id;
          const [first, ...rest] = [
            wanted,
            ...config.chains.map((c) => c.id).filter((id) => id !== wanted),
          ];
          const namespace = (ids: number[]) => ({
            eip155: {
              methods: METHODS,
              events: EVENTS,
              chains: ids.map(caip),
              rpcMap,
            },
          });
          chainId = undefined;
          // a session without our marker is an orphan (late approval of an
          // abandoned pairing): drop it instead of connecting silently
          if (p.session && !(await config.storage?.getItem(SESSION_KEY))) {
            await p.disconnect();
          }
          if (!p.session) {
            const mine = ++attempt;
            await p.connect({
              namespaces: namespace([first]),
              optionalNamespaces: namespace(rest),
            });
            if (mine !== attempt) {
              await p.disconnect();
              throw new Error('WalletConnect: pairing abandoned');
            }
            keepChain(p, first);
          }
          const accounts = sessionAccounts(p);
          if (accounts.length === 0)
            throw new Error('WalletConnect: no accounts');
          chainId = await this.getChainId();
          await config.storage?.setItem(SESSION_KEY, true);
          // wagmi's withCapabilities generic makes the accounts type unreachable from plain addresses
          return {
            accounts: [...new Set(accounts.map((a) => a.address))] as never,
            chainId,
          };
        },
        async disconnect() {
          await config.storage?.removeItem(SESSION_KEY);
          attempt++;
          chainId = undefined;
          // only the provider already open: creating one here would open a
          // relay socket just to tear it down
          if (!provider) return;
          // a failed init has nothing to close
          const p = await provider.catch(() => undefined);
          provider = undefined;
          if (!p) return;
          p.removeListener('accountsChanged', onAccountsChanged);
          p.removeListener('chainChanged', onChainChanged);
          p.removeListener('session_delete', onDisconnect);
          p.removeListener('disconnect', onDisconnect);
          // without a session there is nothing to close; the pending connect()
          // is invalidated by `attempt` (abortPairingAttempt is a no-op upstream)
          if (!p.session) return;
          await p
            .disconnect()
            .catch((e: unknown) =>
              console.warn('WalletConnect: disconnect failed', e),
            );
        },
        async getAccounts(): Promise<readonly Address[]> {
          const p = await this.getProvider();
          return [...new Set(sessionAccounts(p).map((a) => a.address))];
        },
        async getChainId() {
          if (chainId !== undefined) return chainId;
          const p = await this.getProvider();
          // "eip155:<id>" at pairing; a bare "<id>" once the provider
          // switches chain or restores the session from storage
          const fromNs = p.namespaces?.eip155?.defaultChain;
          const id = fromNs
            ? Number(fromNs.split(':').pop())
            : sessionAccounts(p)[0]?.chainId;
          return id ?? config.chains[0].id;
        },
        async isAuthorized() {
          // no marker, no provider: reload by a stranger opens no socket
          if (!(await config.storage?.getItem(SESSION_KEY))) return false;
          const p = await this.getProvider();
          if (p.session && sessionAccounts(p).length > 0) return true;
          await config.storage?.removeItem(SESSION_KEY);
          return false;
        },
        async switchChain({ chainId: id }) {
          const chain = config.chains.find((c) => c.id === id);
          if (!chain) throw new Error(`WalletConnect: unknown chain ${id}`);
          const p = await this.getProvider();
          if (!sessionAccounts(p).some((a) => a.chainId === id)) {
            await p.request({
              method: 'wallet_switchEthereumChain',
              params: [{ chainId: numberToHex(id) }],
            });
          }
          p.setDefaultChain(caip(id), rpcMap[id]);
          chainId = id;
          config.emitter.emit('change', { chainId: id });
          return chain;
        },
        onAccountsChanged,
        onChainChanged,
        onDisconnect,
      };
    },
  );
}

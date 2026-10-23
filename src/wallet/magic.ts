import { ref } from 'vue';
import { createConnector } from '@wagmi/core';
import { getAddress, type Address } from 'viem';

import { env } from '@/config/aa';
import { DEFAULT_NETWORK, Networks } from '@/config/networks';
import { useUser } from '@/composables/useUser';

export const MAGIC_CONNECTOR_ID = 'magic';
const magicApiKey = env('VITE_MAGIC_PUBLISHABLE_KEY');
export const isMagicEnabled = magicApiKey !== undefined;

// magic-sdk and its OAuth extension are code-split: only fetched when Magic is
// enabled and actually used, never in the main bundle.
async function createMagic(chainId: number) {
  const rpcUrl = Networks.find((c) => c.id === chainId)?.rpcUrls.default
    .http[0];
  if (!rpcUrl) throw new Error(`Magic: no RPC url for chain ${chainId}`);
  const [{ Magic }, { OAuthExtension }] = await Promise.all([
    import('magic-sdk'),
    import('@magic-ext/oauth2'),
  ]);
  return new Magic(magicApiKey ?? '', {
    network: { rpcUrl, chainId },
    extensions: [new OAuthExtension()],
  });
}

type MagicInstance = Awaited<ReturnType<typeof createMagic>>;

// Shared by the connector and the login helpers so both talk to the same iframe.
// Holds the promise so concurrent callers share one instance.
let current: { magic: Promise<MagicInstance>; chainId: number } | undefined;

// magic-sdk exposes no teardown for the old instance's iframe, so a real chain
// change just replaces it; add cleanup when the SDK offers one.
function getMagic(
  chainId = current?.chainId ?? DEFAULT_NETWORK.id,
): Promise<MagicInstance> {
  if (current?.chainId === chainId) return current.magic;
  const entry = { magic: createMagic(chainId), chainId };
  current = entry;
  // don't cache a failed chunk load; let the next call retry
  entry.magic.catch(() => {
    if (current === entry) current = undefined;
  });
  return entry.magic;
}

// A login starts on the chain the user picked in the app, not on whichever
// chain the last instance was built for.
const getMagicForSelectedChain = () => getMagic(useUser().network.value.id);

// Set when Magic could not be reached on reload: the session may be alive, so
// the connect modal asks for a reload instead of a new login.
export const magicSessionUnverified = ref(false);
const VERIFY_RETRY_MS = 1500;
const VERIFY_TIMEOUT_MS = 5000;

// undefined: Magic unreachable (offline / auth.magic.link blocked), retried once
async function verifySession(): Promise<boolean | undefined> {
  for (const wait of [0, VERIFY_RETRY_MS]) {
    await new Promise((r) => setTimeout(r, wait));
    try {
      // isLoggedIn() can stall on a dead auth.magic.link; a stalled check
      // counts as unreachable like a failed one, never as a hang.
      const loggedIn = await Promise.race([
        (await getMagic()).user.isLoggedIn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Magic: session check timed out')),
            VERIFY_TIMEOUT_MS,
          ),
        ),
      ]);
      magicSessionUnverified.value = false;
      return loggedIn;
    } catch (e) {
      console.error('Magic: could not verify session', e);
    }
  }
  magicSessionUnverified.value = true;
  return undefined;
}

async function readAccounts(magic: MagicInstance): Promise<Address[]> {
  const accounts = await magic.rpcProvider.request<string[]>({
    method: 'eth_accounts',
  });
  return accounts.map((a) => getAddress(a));
}

export function magicConnector() {
  return createConnector<
    MagicInstance['rpcProvider'],
    Record<string, unknown>,
    { 'magic.session': boolean }
  >((config) => ({
    id: MAGIC_CONNECTOR_ID,
    name: 'Email / Google',
    type: 'magic',

    async connect({ chainId } = {}) {
      const magic = await getMagic(chainId);
      if (!(await magic.user.isLoggedIn())) {
        throw new Error('Magic: not logged in');
      }
      const accounts = await readAccounts(magic);
      await config.storage?.setItem('magic.session', true);
      magicSessionUnverified.value = false;
      // wagmi's connect action maps withCapabilities from plain addresses
      return { accounts: accounts as never, chainId: await this.getChainId() };
    },
    async disconnect() {
      try {
        await (await getMagic()).user.logout();
      } finally {
        await config.storage?.removeItem('magic.session');
      }
    },
    getAccounts: async () => readAccounts(await getMagic()),
    getChainId: async () => current?.chainId ?? DEFAULT_NETWORK.id,
    async getProvider() {
      // Boot-time reconnect calls this on every load; without the session
      // marker it would fetch magic-sdk and contact auth.magic.link for every
      // visitor.
      if (!current && !(await config.storage?.getItem('magic.session'))) {
        throw new Error('Magic: no session');
      }
      // wagmi's reconnect asks for the provider before isAuthorized(): when
      // magic-sdk itself fails to load, the session is unverified, not gone
      const magic = await getMagic().catch((e: unknown) => {
        magicSessionUnverified.value = true;
        throw e;
      });
      return magic.rpcProvider;
    },
    async isAuthorized() {
      if (!(await config.storage?.getItem('magic.session'))) return false;
      const loggedIn = await verifySession();
      // unreachable is transient, so keep the marker
      if (loggedIn === false) await config.storage?.removeItem('magic.session');
      return loggedIn === true;
    },
    async switchChain({ chainId }) {
      const chain = config.chains.find((c) => c.id === chainId);
      if (!chain) throw new Error(`Magic: unknown chain ${chainId}`);
      await getMagic(chainId);
      config.emitter.emit('change', { chainId });
      return chain;
    },
    async setup() {
      // Magic's provider emits no session events: re-check when the tab comes
      // back (logout in another tab, expired session)
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible' || !current) return;
        if (!(await config.storage?.getItem('magic.session'))) return;
        const magic = await getMagic();
        if (await magic.user.isLoggedIn().catch(() => true)) return;
        await config.storage?.removeItem('magic.session');
        config.emitter.emit('disconnect');
      });
    },
    onAccountsChanged() {},
    onChainChanged() {},
    onDisconnect() {},
  }));
}

export async function loginWithEmail(email: string): Promise<void> {
  await (await getMagicForSelectedChain()).auth.loginWithEmailOTP({ email });
}

// Marks a Google redirect started by this tab, so an unrelated ?state=&code=
// URL is not taken for its result.
const OAUTH_PENDING = 'magic.oauthPending';

export async function loginWithGoogle(redirectURI: string): Promise<void> {
  sessionStorage.setItem(OAUTH_PENDING, '1');
  await (
    await getMagicForSelectedChain()
  ).oauth2.loginWithRedirect({
    provider: 'google',
    redirectURI,
  });
}

const OAUTH_PARAMS = ['magic_credential', 'state', 'code', 'scope'];

function hasOAuthResult(search: string): boolean {
  const p = new URLSearchParams(search);
  const pending = sessionStorage.getItem(OAUTH_PENDING) !== null;
  return (
    p.has('magic_credential') || (pending && p.has('state') && p.has('code'))
  );
}

export async function completeOAuthRedirect(): Promise<boolean> {
  if (!isMagicEnabled || !hasOAuthResult(window.location.search)) return false;
  try {
    await (await getMagicForSelectedChain()).oauth2.getRedirectResult();
  } finally {
    sessionStorage.removeItem(OAUTH_PENDING);
    // the code is single-use, even when it failed: drop it so a reload
    // doesn't replay getRedirectResult
    const url = new URL(window.location.href);
    OAUTH_PARAMS.forEach((k) => url.searchParams.delete(k));
    history.replaceState(history.state, '', url);
  }
  return true;
}

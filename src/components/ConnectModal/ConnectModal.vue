<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { computedAsync, useClipboard, useEventListener } from '@vueuse/core';
import QRCode from 'qrcode';
import { useConnect, useConnectors } from '@wagmi/vue';
import { isPasskeyCancelled } from '@doiim/passkeys';
import { hasKnownPasskey } from '@doiim/passkeys/storage';
import { PASSKEY_CONNECTOR_ID, setPasskeyIntent } from '@doiim/passkeys/wagmi';
import CustomButton from '@/components/ui/CustomButton.vue';
import IconButton from '@/components/ui/IconButton.vue';
import CloseIcon from '@/assets/closeAlertIcon.svg';
import FingerprintIcon from '@/assets/fingerprint.svg';
import GoogleIcon from '@/assets/wallet/google.svg';
import AccountIcon from '@/assets/account.svg';
import WalletConnectIcon from '@/assets/wallet/walletconnect.svg';
import ChevronIcon from '@/assets/chevronDown.svg';
import copyIcon from '@/assets/copyPix.svg?url';
import { isPasskeyAvailable } from '@/wallet/wagmi';
import { useRouter } from 'vue-router';
import { rpId } from '@/config/aa';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useUser } from '@/composables/useUser';
import { useConnectModal } from '@/wallet/useConnectModal';
import {
  MAGIC_CONNECTOR_ID,
  isMagicEnabled,
  loginWithEmail,
  loginWithGoogle,
  magicSessionUnverified,
} from '@/wallet/magic';
import { WALLETCONNECT_ID } from '@/wallet/walletConnect';

const { isOpen, close } = useConnectModal();
const user = useUser();
const { mutateAsync: connectAsync } = useConnect();
const connectors = useConnectors();
const router = useRouter();
const accountRouter = useAccountRouter();

// Recovery lives in the account panel beside the offer card on the home page.
const openRecovery = () => {
  close();
  accountRouter.reset();
  accountRouter.push('recovery');
  void router.push('/');
};

type Connector = (typeof connectors.value)[number];

const dialogRef = ref<HTMLElement | null>(null);
const email = ref('');
const loadingKey = ref<string | null>(null);
const error = ref('');
const wcUri = ref('');
// qrcode stays eager: the buyer's scan-me QR renders from it (main chunk), and
// a dynamic import of a module that ships anyway is only a hop.
const wcQr = computedAsync(
  () =>
    wcUri.value ? QRCode.toDataURL(wcUri.value, { margin: 1, width: 240 }) : '',
  '',
);
const clipboard = useClipboard({ copiedDuring: 2000 });
let previouslyFocused: HTMLElement | null = null;
let previousOverflow = '';
// identity of the active run; a stale run (after Voltar/close) never matches it
let currentRun: object | null = null;
// cleanup of the active WalletConnect pairing, local to its run
let stopWc: (() => void) | null = null;

const byId = (id: string) => connectors.value.find((c) => c.id === id);
// Offered only while the selected chain has an AA rail: the connector is built
// for the default chain, so connecting here on another one would land the user
// on a chain they did not select.
const passkey = computed(() =>
  isPasskeyAvailable() ? byId(PASSKEY_CONNECTOR_ID) : undefined,
);
// No passkey ever used in this browser: creating one is the likely first step,
// so it takes the main row and "login" moves to the small one. Read on open.
const knownPasskey = ref(false);
const passkeyMain = computed(() => (knownPasskey.value ? 'login' : 'create'));
const passkeyAlt = computed(() => (knownPasskey.value ? 'create' : 'login'));
const walletConnect = computed(() => byId(WALLETCONNECT_ID));
// the generic 'injected' connector is only a fallback: hide it when EIP-6963
// wallets were discovered (they carry their own ids) or there is no window.ethereum
const injected = computed(() => {
  const all = connectors.value.filter((c) => c.type === 'injected');
  const discovered = all.filter((c) => c.id !== 'injected');
  return discovered.length || !('ethereum' in window) ? discovered : all;
});

// pairing in progress (or showing its QR): the card body becomes the QR view
const wcView = computed(
  () => !!walletConnect.value && loadingKey.value === walletConnect.value.uid,
);
// 'injected' is the generic connector; never show that raw id to the user
const walletName = (c: Connector) =>
  c.id === 'injected' ? 'Carteira do navegador' : c.name;
const hasQuickLogin = computed(() => !!passkey.value || isMagicEnabled);
const hasWalletList = computed(
  () => injected.value.length > 0 || !!walletConnect.value,
);

function reset() {
  stopWc?.();
  currentRun = null;
  loadingKey.value = null;
  error.value = '';
  wcUri.value = '';
}

useEventListener(document, 'keydown', (e) => isOpen.value && onKeydown(e));

watch(isOpen, async (open) => {
  if (!open) {
    reset();
    email.value = '';
    document.body.style.overflow = previousOverflow;
    previouslyFocused?.focus();
    return;
  }
  previouslyFocused = document.activeElement as HTMLElement | null;
  previousOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  if (magicSessionUnverified.value) error.value = MAGIC_UNVERIFIED_ERROR;
  knownPasskey.value = hasKnownPasskey();
  await nextTick();
  dialogRef.value?.focus();
});

// the focused element is removed when the body switches view; keep focus inside the dialog
watch(wcView, async () => {
  await nextTick();
  dialogRef.value?.focus();
});

const WC_START_ERROR =
  'Não foi possível iniciar o WalletConnect. Tente novamente.';
const WC_URI_TIMEOUT_MS = 15_000;

const MAGIC_UNVERIFIED_ERROR =
  'Não foi possível verificar sua sessão de email/Google. Recarregue a página antes de entrar de novo.';

const PASSKEY_LOGIN_ERROR =
  'Não foi possível usar um passkey. Tente de novo, use um passkey de outro aparelho (QR) ou crie um novo.';

class WalletConnectStartError extends Error {}
class PasskeyLoginError extends Error {}

function messageOf(e: unknown): string {
  if (e instanceof WalletConnectStartError) return WC_START_ERROR;
  if (e instanceof PasskeyLoginError) return PASSKEY_LOGIN_ERROR;
  if (isPasskeyCancelled(e) || isUserRejection(e)) return 'Conexão cancelada.';
  return 'Não foi possível conectar. Tente novamente.';
}

// A rejection counts as the user's cancel only when the wallet says the user
// did it — EIP-1193 code 4001 or phrasing that names them. Relayers and
// paymasters reject too, and those are failures to retry, not cancellations.
function isUserRejection(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  if ('code' in e && e.code === 4001) return true;
  const msg = e instanceof Error ? e.message : '';
  return (
    /\buser (rejected|denied|cancel+ed|aborted|declined)/i.test(msg) ||
    /\b(rejected|denied|cancel+ed|declined) by the user/i.test(msg)
  );
}

async function run(key: string, action: () => Promise<unknown>) {
  if (loadingKey.value) return;
  const mine = {};
  currentRun = mine;
  loadingKey.value = key;
  error.value = '';
  try {
    await action();
    if (currentRun === mine) close();
  } catch (e) {
    // after Voltar/close the run is stale: its rejection is expected, not an error
    if (currentRun === mine) error.value = messageOf(e);
  } finally {
    if (currentRun === mine) loadingKey.value = null;
  }
}

const connectWith = (connector: Connector) =>
  connectAsync({ connector, chainId: user.network.value.id });

const onConnector = (connector: Connector) =>
  run(connector.uid, () => connectWith(connector));

// "not found" and "dismissed" are indistinguishable (NotAllowedError), so on
// login both get the same way out: retry, another device (QR), or create.
function onPasskey(connector: Connector, intent: 'login' | 'create') {
  return run(connector.uid, async () => {
    setPasskeyIntent(intent);
    try {
      await connectWith(connector);
    } catch (e) {
      throw intent === 'login' && isPasskeyCancelled(e)
        ? new PasskeyLoginError()
        : e;
    } finally {
      // the connector resets it only once it reads it; a refused connect must
      // not carry 'create' into the next attempt
      setPasskeyIntent('login');
    }
  });
}

async function onEmail() {
  const connector = byId(MAGIC_CONNECTOR_ID);
  const value = email.value.trim();
  if (!connector || !value) return;
  await run('email', async () => {
    await loginWithEmail(value);
    await connectWith(connector);
  });
}

const onGoogle = () =>
  run('google', () =>
    // Magic matches the redirect exactly: one URL whatever route we are on.
    // Resolved against the page, so a relative base ('./') keeps a subpath.
    loginWithGoogle(
      new URL(import.meta.env.BASE_URL, window.location.href).href,
    ),
  );

type WcProvider = {
  on: (event: string, cb: (uri: string) => void) => void;
  removeListener: (event: string, cb: (uri: string) => void) => void;
};

const isWcProvider = (p: unknown): p is WcProvider =>
  typeof p === 'object' &&
  p !== null &&
  'on' in p &&
  typeof p.on === 'function' &&
  'removeListener' in p &&
  typeof p.removeListener === 'function';

async function onWalletConnect() {
  const connector = walletConnect.value;
  if (!connector) return;
  await run(connector.uid, async () => {
    const provider = await connector.getProvider();
    if (!isWcProvider(provider)) throw new WalletConnectStartError();
    wcUri.value = '';
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;
    let connected = false;
    const onUri = (uri: string) => {
      clearTimeout(timer);
      wcUri.value = uri;
    };
    // idempotent: timer + listener always go; an unfinished pairing is dropped
    // so a late phone approval cannot connect silently
    const stop = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      provider.removeListener('display_uri', onUri);
      if (stopWc === stop) stopWc = null;
      if (!connected)
        void connector
          .disconnect()
          .catch((e: unknown) =>
            console.warn('WalletConnect: abort failed', e),
          );
    };
    stopWc = stop;
    provider.on('display_uri', onUri);
    const noUri = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new WalletConnectStartError()),
        WC_URI_TIMEOUT_MS,
      );
    });
    try {
      await Promise.race([connectWith(connector), noUri]);
      connected = true;
    } catch (e) {
      // no URI yet means pairing never started (bad project id, relay down)
      throw wcUri.value ? e : new WalletConnectStartError();
    } finally {
      stop();
    }
  });
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') return close();
  if (e.key !== 'Tab' || !dialogRef.value) return;
  const items = Array.from(
    dialogRef.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled])',
    ),
  );
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === dialogRef.value)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

onBeforeUnmount(() => {
  stopWc?.();
  if (isOpen.value) document.body.style.overflow = previousOverflow;
});
</script>

<template>
  <Transition name="page">
    <div
      v-if="isOpen"
      class="connect-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm"
      @click.self="close"
    >
      <div
        ref="dialogRef"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-modal-title"
        tabindex="-1"
        class="connect-card bg-white rounded-xl shadow-lg p-6 w-[min(400px,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] overflow-y-auto overscroll-contain text-gray-900 outline-none"
      >
        <div class="flex items-center justify-between mb-5">
          <button
            v-if="wcView"
            type="button"
            class="back-button"
            @click="reset"
          >
            <ChevronIcon aria-hidden="true" class="w-5 h-5 rotate-90" />
            Voltar
          </button>
          <h2
            id="connect-modal-title"
            class="text-xl font-bold"
            :class="{ 'sr-only': wcView }"
          >
            Conectar carteira
          </h2>
          <button
            type="button"
            aria-label="Fechar"
            class="close-button"
            @click="close"
          >
            <CloseIcon aria-hidden="true" class="w-3.5 h-3.5" />
          </button>
        </div>

        <p v-if="error" role="alert" class="error-banner mb-4">
          {{ error }}
        </p>

        <section
          v-if="wcView"
          class="flex flex-col items-center gap-4"
          aria-live="polite"
        >
          <p class="text-lg font-bold">WalletConnect</p>
          <p class="text-sm text-gray-500 text-center -mt-3">
            Escaneie o QR code com o app da sua carteira
          </p>
          <div
            class="qr-frame flex items-center justify-center w-64 h-64 rounded-2xl border border-gray-200 bg-white p-2"
          >
            <img
              v-if="wcQr"
              :src="wcQr"
              alt="QR code do WalletConnect"
              class="w-full h-full"
            />
            <span v-else class="spinner" role="status">
              <span class="sr-only">Gerando QR code...</span>
            </span>
          </div>
          <IconButton
            v-if="wcQr"
            :text="clipboard.copied.value ? 'Copiado!' : 'Copiar link'"
            :icon="copyIcon"
            variant="secondary"
            size="lg"
            @click="clipboard.copy(wcUri)"
          />
        </section>

        <template v-else>
          <section v-if="isMagicEnabled" class="flex flex-col gap-3">
            <label for="connect-email" class="sr-only">E-mail</label>
            <input
              id="connect-email"
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="Seu e-mail"
              class="w-full border border-gray-300 rounded-xl py-3 px-4 placeholder:text-gray-500 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/50"
              @keydown.enter.prevent="onEmail"
            />
            <CustomButton
              text="Receber código"
              size="lg"
              :is-disabled="!email.trim() || !!loadingKey"
              :loading="loadingKey === 'email'"
              @button-clicked="onEmail"
            />
            <button
              type="button"
              class="row soft"
              :disabled="!!loadingKey"
              @click="onGoogle"
            >
              <span class="row-icon bg-white"
                ><GoogleIcon aria-hidden="true" class="w-5 h-5"
              /></span>
              <span class="row-text">
                <span class="row-title">Continuar com Google</span>
              </span>
              <span v-if="loadingKey === 'google'" class="spinner small" />
            </button>
            <button
              v-if="rpId"
              type="button"
              class="self-center text-sm text-gray-600 underline hover:text-gray-900 cursor-pointer"
              @click="openRecovery"
            >
              Perdeu o acesso ao e-mail? Recuperar com passkey de backup
            </button>
          </section>

          <section
            v-if="passkey"
            class="flex flex-col gap-1"
            :class="{ 'mt-3': isMagicEnabled }"
          >
            <button
              type="button"
              class="row soft"
              :disabled="!!loadingKey"
              @click="onPasskey(passkey, passkeyMain)"
            >
              <span class="row-icon bg-white"
                ><FingerprintIcon aria-hidden="true" class="w-5 h-5"
              /></span>
              <span class="row-text">
                <span class="row-title">{{
                  knownPasskey ? 'Entrar com passkey' : 'Criar passkey'
                }}</span>
                <span class="row-subtitle">Biometria ou PIN do aparelho</span>
              </span>
              <span v-if="loadingKey === passkey.uid" class="spinner small" />
            </button>
            <button
              type="button"
              class="row"
              :disabled="!!loadingKey"
              @click="onPasskey(passkey, passkeyAlt)"
            >
              <span class="row-text">
                <span class="row-title text-sm">{{
                  knownPasskey ? 'Criar novo passkey' : 'Já tenho um passkey'
                }}</span>
              </span>
            </button>
          </section>

          <div
            v-if="hasQuickLogin && hasWalletList"
            class="flex items-center gap-3 my-4 text-sm text-gray-500"
            aria-hidden="true"
          >
            <span class="flex-1 h-px bg-gray-200" />ou
            <span class="flex-1 h-px bg-gray-200" />
          </div>

          <section v-if="hasWalletList" class="flex flex-col gap-1">
            <button
              v-for="c in injected"
              :key="c.uid"
              type="button"
              class="row"
              :disabled="!!loadingKey"
              @click="onConnector(c)"
            >
              <img
                v-if="c.icon"
                :src="c.icon"
                alt=""
                class="row-icon object-cover"
              />
              <span v-else class="row-icon bg-gray-100"
                ><AccountIcon aria-hidden="true" class="w-5 h-5"
              /></span>
              <span class="row-text">
                <span class="row-title">{{ walletName(c) }}</span>
              </span>
              <span v-if="loadingKey === c.uid" class="spinner small" />
              <ChevronIcon aria-hidden="true" class="chevron -rotate-90" />
            </button>
            <button
              v-if="walletConnect"
              type="button"
              class="row"
              :disabled="!!loadingKey"
              @click="onWalletConnect"
            >
              <WalletConnectIcon aria-hidden="true" class="row-icon" />
              <span class="row-text">
                <span class="row-title">WalletConnect</span>
                <span class="row-subtitle">Escaneie com o celular</span>
              </span>
              <ChevronIcon aria-hidden="true" class="chevron -rotate-90" />
            </button>
          </section>
        </template>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
@reference "tailwindcss";
.row {
  @apply flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors duration-150 cursor-pointer;
  @apply hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400;
}

.row.soft {
  @apply bg-gray-100 hover:bg-gray-200;
}

.row:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.row-icon {
  @apply flex h-10 w-10 shrink-0 items-center justify-center rounded-full;
}

img.row-icon {
  @apply rounded-xl;
}

.row-text {
  @apply flex min-w-0 flex-1 flex-col;
}

.row-title {
  @apply truncate font-semibold leading-tight text-gray-900;
}

.row-subtitle {
  @apply text-sm leading-snug text-gray-600;
}

.chevron {
  @apply h-4 w-4 shrink-0 text-gray-400;
}

.close-button,
.back-button {
  @apply flex items-center rounded-full text-gray-900 transition-colors duration-150 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400;
}

.close-button {
  @apply h-8 w-8 justify-center;
}

.back-button {
  @apply gap-2 py-1 pr-3 pl-1 font-semibold;
}

.error-banner {
  @apply rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700;
}

.spinner {
  @apply inline-block h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-amber-400;
}

.spinner.small {
  @apply h-5 w-5 border-2;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }

  .connect-overlay.page-enter-active,
  .connect-overlay.page-leave-active {
    transition: none;
  }
}
</style>

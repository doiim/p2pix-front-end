<script setup lang="ts">
import { computed, onMounted, watch, type Component } from 'vue';
import { useDocumentVisibility, useIntervalFn } from '@vueuse/core';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';
import AccountHomeView from './AccountHomeView.vue';
import ReceiveView from './ReceiveView.vue';
import RecoveryView from './RecoveryView.vue';
import SendView from './SendView.vue';
import SendStatusView from './SendStatusView.vue';

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const form = useSendForm();
const user = useUser();

const views: Record<typeof accountRouter.current.value, Component> = {
  account: AccountHomeView,
  receive: ReceiveView,
  send: SendView,
  sendStatus: SendStatusView,
  recovery: RecoveryView,
};
const activeView = computed(() => views[accountRouter.current.value]);

const refresh = async () => {
  // Recovery opens the card with no wallet connected: there is nothing to read.
  if (!account.isReady.value) return;
  await account.refreshBalances();
  if (account.error.value)
    user.showToast('error', 'Não foi possível ler o saldo.');
  void account.refreshDiscovered();
};

// Picks up deposits made from outside the app on the selected network; the
// other networks are re-read only on mount, on a switch and after a send.
const visibility = useDocumentVisibility();
useIntervalFn(() => {
  if (visibility.value === 'visible' && !account.busy.value)
    void account.refreshBalances();
}, 15_000);

// Switching between Comprar and Vender remounts the panel: keep the open
// screen and the balances, only re-read them.
onMounted(() => void refresh());

// TopBar owns network switching and disconnect; start over on either. A send
// in flight keeps its screen, or Enviar would be offered again before it ends.
watch([() => user.network.value.id, account.smartAccountAddress], () => {
  // Recovery runs with no wallet, and its login may switch the network itself.
  if (accountRouter.current.value === 'recovery') return;
  account.reset();
  void refresh();
  if (account.busy.value) return;
  form.reset();
  accountRouter.reset();
});
</script>

<template>
  <!-- On phones an open flow moves the panel above the offer card. -->
  <section
    aria-label="Sua conta"
    class="main-container lg:max-w-[21.375rem]!"
    :class="{ 'max-lg:order-first': accountRouter.current.value !== 'account' }"
  >
    <div class="flex flex-col gap-4 w-full p-5 rounded-lg bg-white">
      <component :is="activeView" />
    </div>
  </section>
</template>

<!-- Shared, prefixed classes for the screens inside the card. -->
<style>
@reference "tailwindcss";

.acct-title {
  @apply text-xl font-bold text-gray-900;
}

.acct-label {
  @apply text-sm font-medium text-gray-600;
}

.acct-link {
  @apply text-xs font-semibold text-gray-900 transition-opacity hover:opacity-70 disabled:opacity-40 cursor-pointer;
}

a.acct-link:hover {
  background-color: transparent;
}

.acct-empty {
  @apply py-4 text-center text-sm text-gray-400;
}

.acct-network {
  @apply flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-gray-100 text-[11px] text-gray-600 whitespace-nowrap;
}
</style>

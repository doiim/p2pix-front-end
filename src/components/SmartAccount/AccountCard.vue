<script setup lang="ts">
import { computed, type Component } from 'vue';
import ChevronDown from '@/assets/chevronDown.svg';
import CloseAlertIcon from '@/assets/closeAlertIcon.svg';
import router from '@/router/index';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import AccountHomeView from './AccountHomeView.vue';
import ReceiveView from './ReceiveView.vue';
import SendView from './SendView.vue';
import SendPreviewView from './SendPreviewView.vue';

const accountRouter = useAccountRouter();
const { current, canGoBack, title, back } = accountRouter;
const { busy } = usePasskeyAccount();
const form = useSendForm();

const views: Record<typeof current.value, Component> = {
  account: AccountHomeView,
  receive: ReceiveView,
  send: SendView,
  sendPreview: SendPreviewView,
};
const activeView = computed(() => views[current.value]);

const handleClose = () => {
  form.reset();
  accountRouter.reset();
  router.push({ name: 'home' });
};
</script>

<template>
  <div class="main-container max-w-md">
    <header class="header">
      <button
        v-if="canGoBack"
        type="button"
        class="header-btn"
        :disabled="busy"
        @click="back"
      >
        <ChevronDown class="h-5 w-5 rotate-90" />
        Voltar
      </button>
      <span v-else />
      <span class="text-center text-base font-semibold">{{ title }}</span>
      <button
        type="button"
        class="header-btn justify-end"
        aria-label="Fechar"
        :disabled="busy"
        @click="handleClose"
      >
        <CloseAlertIcon class="h-5 w-5 [&_path]:fill-current" />
      </button>
    </header>
    <component :is="activeView" />
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.header {
  @apply grid w-full grid-cols-[5rem_1fr_5rem] items-center text-white;
}

.header-btn {
  @apply flex items-center gap-1 text-sm font-medium text-white transition-colors hover:text-gray-300 disabled:opacity-50 cursor-pointer;
}
</style>

<!-- Shared, prefixed classes for the screens inside the card. -->
<style>
@reference "tailwindcss";

.acct-label {
  @apply text-sm font-medium text-gray-600;
}

.acct-link {
  @apply text-xs font-semibold text-emerald-500 transition-opacity hover:opacity-70 disabled:opacity-40 cursor-pointer;
}

a.acct-link:hover {
  background-color: transparent;
}

.acct-empty {
  @apply py-4 text-center text-sm text-gray-400;
}

.acct-row {
  @apply flex items-center gap-3 py-3;
}
</style>

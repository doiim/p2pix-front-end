<script setup lang="ts">
import { computed } from 'vue';
import { useClipboard } from '@vueuse/core';
import CopyIcon from '@/assets/copyPix.svg';
import KeyIcon from '@/assets/key.svg';
import RedirectIcon from '@/assets/redirect.svg';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';

const accountRouter = useAccountRouter();
const account = usePasskeyAccount();
const user = useUser();
const form = useSendForm();
const { copy } = useClipboard({ legacy: true });

const short = (value: string) => `${value.slice(0, 10)}…${value.slice(-8)}`;
const tiny = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;

const sent = form.lastSent;
const explorer = computed(() => sent.value?.network.blockExplorers?.default);
const explorerHref = computed(() =>
  sent.value?.txHash
    ? account.explorerTxUrl(sent.value.txHash, sent.value.network)
    : null,
);

const copyHash = async () => {
  await copy(sent.value?.txHash ?? '');
  user.showToast('success', 'Hash copiado!');
};

const handleDone = () => {
  sent.value = null;
  accountRouter.reset();
};
</script>

<template>
  <div
    v-if="account.busy.value"
    class="flex flex-col items-center gap-3 py-2 text-center"
  >
    <div>
      <h2 class="acct-title">Confirme com sua passkey</h2>
      <p class="text-xs text-gray-600">
        Enviar {{ form.amountText.value }} para
        {{ tiny(form.receiver.value.trim()) }}
      </p>
    </div>
    <span
      class="flex items-center justify-center w-9 h-9 rounded-full bg-gray-100"
    >
      <KeyIcon aria-hidden="true" />
    </span>
    <p class="text-sm text-gray-900">
      O navegador vai pedir sua passkey para assinar o envio de
      {{ form.amountText.value }} para
      <span class="font-mono">{{ tiny(form.receiver.value.trim()) }}</span
      >.
    </p>
  </div>

  <template v-else-if="sent">
    <p
      class="flex items-center gap-2 -mx-5 -mt-5 px-5 py-3 rounded-t-lg bg-amber-400 text-sm font-bold text-gray-900"
    >
      <span
        class="flex items-center justify-center w-5 h-5 rounded-full bg-white text-xs"
        aria-hidden="true"
        >✓</span
      >
      Tudo certo! Envio realizado
    </p>
    <div class="flex flex-col items-center gap-1 pb-2 border-b border-gray-200">
      <p class="flex items-center gap-2 text-2xl font-bold text-gray-900">
        <img
          :src="
            sent.token
              ? getTokenImage(sent.token)
              : getNetworkImage(sent.network.name)
          "
          alt=""
          class="w-6 h-6"
        />
        {{ sent.amountText }}
      </p>
      <p class="text-xs text-gray-600">
        para <span class="font-mono">{{ short(sent.to) }}</span>
      </p>
    </div>
    <dl
      class="flex flex-col divide-y divide-gray-200 -mt-2 text-sm text-gray-900"
    >
      <div class="flex justify-between gap-2 py-2.5">
        <dt class="text-gray-600">O destino recebeu</dt>
        <dd class="font-semibold">{{ sent.amountText }}</dd>
      </div>
      <div class="flex justify-between gap-2 py-2.5">
        <dt class="text-gray-600">Rede</dt>
        <dd class="flex items-center gap-1 font-semibold">
          <img
            :src="getNetworkImage(sent.network.name)"
            alt=""
            class="w-3.5 h-3.5"
          />
          {{ sent.network.name }}
        </dd>
      </div>
      <div v-if="sent.txHash" class="flex justify-between gap-2 py-2.5">
        <dt class="text-gray-600">Hash</dt>
        <dd class="flex items-center gap-2">
          <span class="font-mono">{{ short(sent.txHash) }}</span>
          <button
            type="button"
            aria-label="Copiar hash da transação"
            class="acct-link"
            @click="copyHash"
          >
            <CopyIcon aria-hidden="true" class="scale-75" />
          </button>
        </dd>
      </div>
    </dl>
    <a
      v-if="explorerHref && explorer"
      :href="explorerHref"
      target="_blank"
      rel="noopener noreferrer"
      class="account-button"
    >
      Ver no {{ explorer.name }}
      <RedirectIcon aria-hidden="true" class="[&_path]:fill-current" />
    </a>
    <button
      type="button"
      class="min-h-11 rounded-lg bg-amber-400 text-sm font-semibold text-gray-900 transition-colors hover:bg-amber-500 cursor-pointer"
      @click="handleDone"
    >
      Fechar
    </button>
  </template>
</template>

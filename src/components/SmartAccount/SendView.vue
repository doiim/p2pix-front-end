<script setup lang="ts">
import { computed } from 'vue';
import CopyIcon from '@/assets/copyPix.svg';
import SendIcon from '@/assets/send.svg';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { useUser } from '@/composables/useUser';
import DropdownChip from './DropdownChip.vue';
import NetworkNotice from './NetworkNotice.vue';

const accountRouter = useAccountRouter();
const account = usePasskeyAccount();
const user = useUser();
const form = useSendForm();

const options = account.assets;
const selected = computed(() =>
  options.value.find((opt) => opt.token === form.token.value),
);
const maxText = computed(
  () =>
    `${formatTokenAmount(form.maxAmount.value, account.decimalsOf(form.token.value))} ${form.symbol.value}`,
);
const amountError = computed(() => {
  if (form.cta.value === 'INCORRECT_VALUE') return 'Informe um valor válido.';
  if (form.cta.value === 'INSUFFICIENT_FUNDS')
    return `Saldo insuficiente: você tem ${maxText.value}`;
  return '';
});
const receiverError = computed(() =>
  form.receiver.value.trim() !== '' && form.receiverAddress.value === null
    ? 'Informe um endereço de destino válido.'
    : '',
);
const canSend = computed(() => form.cta.value === 'SEND');

const handleConfirm = async () => {
  accountRouter.push('sendStatus');
  if (await form.submit()) return;
  // The raw cause is in the console; WebAuthn and bundler errors are English.
  user.showToast(
    'error',
    // The passkey library wraps WebAuthn's NotAllowedError (cancel, timeout).
    /NotAllowedError|Failed to request credential/.test(
      account.error.value ?? '',
    )
      ? 'Assinatura cancelada.'
      : 'Não foi possível enviar.',
  );
  accountRouter.back();
};

const handleCancel = () => {
  form.reset();
  accountRouter.reset();
};
</script>

<template>
  <div>
    <h2 class="acct-title">Enviar</h2>
    <p class="text-sm text-gray-600">Escolha o token, o valor e o destino.</p>
  </div>

  <div class="flex flex-col gap-1">
    <label for="send-amount" class="acct-label">Valor</label>
    <div class="send-field" :class="{ 'is-invalid': amountError }">
      <input
        id="send-amount"
        v-model="form.amountInput.value"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        placeholder="0"
        :aria-invalid="!!amountError"
        class="min-w-0 flex-1 border-none text-lg text-gray-900 outline-none"
      />
      <DropdownChip label="Selecionar token">
        <img
          v-if="selected"
          :src="selected.image"
          :alt="form.symbol.value"
          class="h-5 w-5"
        />
        <span class="text-sm font-medium text-gray-900">
          {{ form.symbol.value }}
        </span>
        <template #items="{ close }">
          <button
            v-for="opt in options"
            :key="opt.symbol"
            type="button"
            class="menu-item"
            @click="(close(), form.setToken(opt.token))"
          >
            <img :src="opt.image" :alt="opt.symbol" class="h-5 w-5" />
            {{ opt.symbol }}
          </button>
        </template>
      </DropdownChip>
    </div>
    <div class="flex items-start justify-between gap-2 text-xs">
      <span :class="amountError ? 'text-red-700' : 'text-gray-500'">
        {{ amountError || `Disponível: ${maxText}` }}
      </span>
      <button type="button" class="acct-link shrink-0" @click="form.setMax()">
        Usar máximo
      </button>
    </div>
  </div>

  <div class="flex flex-col gap-1 pt-4 border-t border-gray-200">
    <div class="flex items-center justify-between">
      <label for="send-receiver" class="acct-label">Endereço de destino</label>
      <button
        type="button"
        class="acct-link flex items-center gap-1"
        @click="form.pasteAddress()"
      >
        <CopyIcon aria-hidden="true" class="scale-75" />
        Colar
      </button>
    </div>
    <input
      id="send-receiver"
      v-model="form.receiver.value"
      type="text"
      spellcheck="false"
      autocomplete="off"
      placeholder="0x..."
      :aria-invalid="!!receiverError"
      class="send-field font-mono text-sm outline-none"
      :class="{ 'is-invalid': receiverError }"
    />
    <p v-if="receiverError" class="text-xs text-red-700">
      {{ receiverError }}
    </p>
  </div>

  <dl
    v-if="form.amount.value && !amountError"
    class="flex justify-between gap-2 pt-4 border-t border-gray-200 text-sm text-gray-900"
  >
    <dt class="font-normal text-gray-600">O destino recebe</dt>
    <dd class="font-semibold">{{ form.amountText.value }}</dd>
  </dl>

  <NetworkNotice />

  <div class="flex items-center justify-between gap-2">
    <button
      type="button"
      class="min-h-11 px-2 text-sm font-semibold text-gray-900 hover:text-gray-600 cursor-pointer"
      @click="handleCancel"
    >
      Cancelar
    </button>
    <button
      type="button"
      class="account-button"
      :disabled="!canSend"
      @click="handleConfirm"
    >
      <SendIcon aria-hidden="true" />
      Confirmar envio
    </button>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.send-field {
  @apply flex items-center gap-2 w-full min-h-11 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900;
}

.send-field.is-invalid {
  @apply border-2 border-red-700;
}
</style>

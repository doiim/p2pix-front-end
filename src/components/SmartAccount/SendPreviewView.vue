<script setup lang="ts">
import { computed, ref } from 'vue';
import RedirectIcon from '@/assets/redirect.svg';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import {
  usePasskeyAccount,
  type SendResult,
} from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';
import CustomButton from '@/components/ui/CustomButton.vue';
import FormCard from '@/components/ui/FormCard.vue';
import validIconUrl from '@/assets/validIcon.svg?url';

const accountRouter = useAccountRouter();
const account = usePasskeyAccount();
const user = useUser();
const { showToast } = user;
const form = useSendForm();

const sent = ref<SendResult | null>(null);
const explorerHref = computed(() =>
  sent.value?.txHash ? account.explorerTxUrl(sent.value.txHash) : null,
);

const handleSend = async () => {
  const to = form.receiverAddress.value;
  if (form.token.value === null || form.amount.value === null || !to) return;
  const result = await account.send({
    token: form.token.value,
    amount: form.amount.value,
    to,
  });
  if (!result) {
    showToast('error', account.error.value ?? 'Falha ao enviar');
    return;
  }
  sent.value = result;
  form.reset();
};

const handleDone = () => accountRouter.reset();
</script>

<template>
  <FormCard v-if="sent" no-border>
    <div class="flex flex-col items-center gap-3 text-center">
      <img :src="validIconUrl" alt="" class="h-12 w-12" />
      <span class="font-bold text-gray-900">Envio realizado</span>
      <a
        v-if="explorerHref"
        :href="explorerHref"
        target="_blank"
        rel="noopener noreferrer"
        class="acct-link flex items-center gap-1"
      >
        Ver no explorador
        <RedirectIcon class="h-4 w-4 [&_path]:fill-current" />
      </a>
      <CustomButton text="Fechar" size="lg" @button-clicked="handleDone" />
    </div>
  </FormCard>

  <FormCard v-else no-border>
    <div class="flex flex-col gap-3">
      <div class="row">
        <span class="acct-label">Valor</span>
        <span class="text-xl font-semibold text-gray-900">{{
          form.amountText.value
        }}</span>
      </div>
      <hr />
      <div class="row">
        <span class="acct-label">Destino</span>
        <span class="break-all text-right text-xs text-gray-900">{{
          form.receiverAddress.value
        }}</span>
      </div>
      <hr />
      <div class="row">
        <span class="acct-label">Rede</span>
        <span class="text-sm text-gray-900">{{ user.network.value.name }}</span>
      </div>
      <p class="text-center text-xs text-red-500">
        Confira o endereço. Envios não podem ser desfeitos.
      </p>
      <div class="mt-2 flex items-center justify-between">
        <button
          type="button"
          class="font-medium text-gray-900 transition-colors hover:text-gray-600 disabled:opacity-50 cursor-pointer"
          :disabled="account.busy.value"
          @click="accountRouter.back()"
        >
          Cancelar
        </button>
        <CustomButton
          text="Enviar"
          size="md"
          :full-width="false"
          :loading="account.busy.value"
          @button-clicked="handleSend"
        />
      </div>
    </div>
  </FormCard>
</template>

<style scoped>
@reference "tailwindcss";

.row {
  @apply flex items-start justify-between gap-4;
}

hr {
  @apply border-gray-300;
}
</style>

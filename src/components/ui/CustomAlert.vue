<script setup lang="ts">
import { ref } from 'vue';
const props = defineProps<{
  type: string;
}>();

const alertText = ref<string>('');

switch (props.type) {
  case 'buy':
    alertText.value =
      'Tudo certo! Os tokens já foram retirados da oferta e estão disponíveis na sua carteira.';
    break;
  case 'sell':
    alertText.value =
      'Tudo certo! Sua oferta foi criada e os tokens estão disponíveis para compra.';
    break;
  case 'redirect':
    alertText.value = 'Existe uma compra em aberto. Continuar?';
    break;
  case 'pixWarning':
    alertText.value =
      'A transação só será processada após efetuado o pagamento do Pix. Caso contrário não conseguiremos comprovar o seu depósito e não será possível transferir os tokens para sua carteira.';
    break;
  case 'lockPending':
    alertText.value =
      'Sua reserva foi criada, mas ainda não conseguimos localizá-la. Aguarde alguns instantes e recarregue a página.';
    break;
  case 'withdraw':
    alertText.value = 'Tudo certo! Saque realizado com sucesso!';
    break;
  case 'withdrawError':
    alertText.value = 'Não foi possível realizar o saque!';
    break;
  case 'sweep':
    alertText.value =
      'Tudo certo! As reservas expiradas voltaram para o seu saldo disponível.';
    break;
  case 'sweepEmpty':
    alertText.value = 'As reservas já foram recuperadas.';
    break;
  case 'sweepError':
    alertText.value = 'Não foi possível recuperar as reservas expiradas!';
    break;
}
</script>
<template>
  <!-- In the page flow, above the cards: it never covers them (no overlay). -->
  <div
    role="status"
    class="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 w-full px-4 py-3 rounded-lg bg-amber-400 text-gray-900"
  >
    <p
      class="flex-1 min-w-[12rem] text-sm sm:text-base font-semibold leading-snug"
    >
      <strong v-if="props.type === 'pixWarning'" class="font-extrabold"
        >ATENÇÃO!</strong
      >
      {{ alertText }}
    </p>
    <button
      v-if="props.type === 'redirect'"
      type="button"
      class="alert-action"
      @click="$emit('go-to-lock')"
    >
      Sim
    </button>
    <button
      v-if="props.type === 'pixWarning'"
      type="button"
      class="alert-action"
      @click="$emit('close-alert')"
    >
      Entendi
    </button>
    <button
      v-else
      type="button"
      aria-label="Fechar alerta"
      class="flex items-center justify-center size-8 rounded cursor-pointer"
      @click="$emit('close-alert')"
    >
      <img src="../../assets/closeAlertIcon.svg" alt="" class="w-3" />
    </button>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.alert-action {
  @apply h-8 px-4 rounded-lg border-2 border-white text-sm font-semibold cursor-pointer;
}
</style>

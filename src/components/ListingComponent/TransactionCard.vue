<script setup lang="ts">
import type { WalletTransaction } from "@/model/WalletTransaction";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { computed } from "vue";

const props = defineProps<{
  transaction: WalletTransaction;
  networkName: NetworkEnum;
  selectedToken: TokenEnum;
}>();

const emit = defineEmits<{
  openExplorer: [transactionHash: string];
}>();

const eventName = computed(() => {
  if (!props.transaction.event) return "Desconhecido";

  const possibleEventName: { [key: string]: string } = {
    DepositAdded: "Oferta",
    LockAdded: "Reserva",
    LockReleased: "Compra",
    DepositWithdrawn: "Retirada",
  };

  return possibleEventName[props.transaction.event] || "Desconhecido";
});

const explorerName = computed(() => {
  return props.networkName === NetworkEnum.sepolia ? "Etherscan" : "Polygonscan";
});

const statusInfo = computed(() => {
  if (eventName.value === "Reserva") {
    switch (props.transaction.lockStatus) {
      case 1:
        return { text: "Em Aberto", color: "bg-amber-300" };
      case 2:
        return { text: "Expirado", color: "bg-[#94A3B8]" };
      case 3:
        return { text: "Finalizado", color: "bg-emerald-300" };
      default:
        return { text: "Finalizado", color: "bg-emerald-300" };
    }
  }
  return { text: "Finalizado", color: "bg-emerald-300" };
});

const showExplorerLink = computed(() => {
  return eventName.value !== "Reserva" || props.transaction.lockStatus !== 1;
});

const showContinueButton = computed(() => {
  return eventName.value === "Reserva" && props.transaction.lockStatus === 1;
});

const handleExplorerClick = () => {
  emit("openExplorer", props.transaction.transactionHash);
};
</script>

<template>
  <div class="w-full bg-white p-4 sm:p-6 rounded-lg">
    <div class="item-container">
      <div class="flex flex-col self-start">
        <span class="text-xs sm:text-sm leading-5 font-medium text-gray-600">
          {{ eventName }}
        </span>
        <span class="text-xl sm:text-xl leading-7 font-semibold text-gray-900">
          {{ transaction.amount }} {{ selectedToken }}
        </span>
      </div>
      <div class="flex flex-col items-center justify-center">
        <div :class="[statusInfo.color, 'status-text']">
          {{ statusInfo.text }}
        </div>
        <div
          v-if="showExplorerLink"
          class="flex gap-2 cursor-pointer items-center justify-self-center w-full"
          @click="handleExplorerClick"
        >
          <span class="last-release-info">{{ explorerName }}</span>
          <img
            alt="Redirect image"
            src="@/assets/redirect.svg?url"
            class="w-3 h-3 sm:w-4 sm:h-4"
          />
        </div>
        <div
          v-if="showContinueButton"
          class="flex gap-2 justify-self-center w-full"
        >
          <RouterLink
            :to="{
              name: 'home',
              force: true,
              state: { lockID: transaction.transactionID },
            }"
            class="router-button"
          >
            Continuar
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.item-container {
  @apply flex justify-between items-center;
}

.status-text {
  @apply text-xs sm:text-base font-medium text-gray-900 rounded-lg text-center mb-2 px-2 py-1 mt-4;
}

.last-release-info {
  @apply font-medium text-xs sm:text-sm text-gray-900 justify-self-center;
}

.router-button {
  @apply rounded-lg border-amber-300 border-2 px-3 py-2 text-gray-900 font-semibold sm:text-base text-xs hover:bg-transparent w-full text-center;
}
</style>


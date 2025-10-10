<script setup lang="ts">
import type { WalletTransaction } from "@/model/WalletTransaction";
import { NetworkEnum, TokenEnum } from "@/model/NetworkEnum";
import { computed } from "vue";
import StatusBadge, { type StatusType } from "../ui/StatusBadge.vue";

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

const statusType = computed((): StatusType => {
  if (eventName.value === "Reserva") {
    switch (props.transaction.lockStatus) {
      case 1:
        return "open";
      case 2:
        return "expired";
      case 3:
        return "completed";
      default:
        return "completed";
    }
  }
  return "completed";
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
        <div class="mb-2 mt-4">
          <StatusBadge :status="statusType" />
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

.last-release-info {
  @apply font-medium text-xs sm:text-sm text-gray-900 justify-self-center;
}

.router-button {
  @apply rounded-lg border-amber-300 border-2 px-3 py-2 text-gray-900 font-semibold sm:text-base text-xs hover:bg-transparent w-full text-center;
}
</style>


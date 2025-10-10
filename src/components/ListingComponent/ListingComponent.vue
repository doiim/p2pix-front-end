<script setup lang="ts">
import { NetworkEnum } from "@/model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import { useUser } from "@/composables/useUser";
import { ref, watch } from "vue";
import SpinnerComponent from "../ui/SpinnerComponent.vue";
import BalanceCard from "./BalanceCard.vue";
import TransactionCard from "./TransactionCard.vue";

const user = useUser();

// props
const props = defineProps<{
  validDeposits: ValidDeposit[];
  walletTransactions: WalletTransaction[];
  activeLockAmount: number;
}>();

const emit = defineEmits(["depositWithdrawn"]);

const { loadingWalletTransactions } = user;

const itemsToShow = ref<WalletTransaction[]>([]);

const callWithdraw = (amount: string) => {
  emit("depositWithdrawn", amount);
};

const showInitialItems = (): void => {
  itemsToShow.value = props.walletTransactions.slice(0, 3);
};

const openEtherscanUrl = (transactionHash: string): void => {
  const networkUrl =
    user.networkName.value == NetworkEnum.sepolia
      ? "sepolia.etherscan.io"
      : "mumbai.polygonscan.com";
  const url = `https://${networkUrl}/tx/${transactionHash}`;
  window.open(url, "_blank");
};

const loadMore = (): void => {
  const itemsShowing = itemsToShow.value.length;
  itemsToShow.value?.push(
    ...props.walletTransactions.slice(itemsShowing, itemsShowing + 3)
  );
};

// watch props changes
watch(props, async (): Promise<void> => {
  const itemsToShowQty = itemsToShow.value.length;
  if (itemsToShowQty == 0) showInitialItems();
  else
    itemsToShow.value =
      props.walletTransactions.length > itemsToShowQty
        ? props.walletTransactions.slice(0, itemsToShowQty)
        : props.walletTransactions;
});

// initial itemsToShow valueb
showInitialItems();
</script>

<template>
  <div
    class="main-container max-w-md flex justify-center items-center min-h-[200px] w-16 h-16"
    v-if="loadingWalletTransactions"
  >
    Carregando ofertas...
    <SpinnerComponent width="8" height="8"></SpinnerComponent>
  </div>
  <div class="main-container max-w-md" v-else>
    <BalanceCard
      v-if="props.validDeposits.length > 0"
      :valid-deposits="props.validDeposits"
      :active-lock-amount="activeLockAmount"
      :selected-token="user.selectedToken.value"
      @withdraw="callWithdraw"
    />

    <TransactionCard
      v-for="item in itemsToShow"
      :key="item.blockNumber"
      :selected-token="user.selectedToken.value"
      :transaction="item"
      :network-name="user.networkName.value"
      @open-explorer="openEtherscanUrl"
    />

    <div
      class="flex flex-col justify-center items-center w-full mt-2 gap-2"
      v-if="
        itemsToShow.length != 0 &&
        itemsToShow.length != props.walletTransactions.length
      "
    >
      <button
        type="button"
        class="text-white font-semibold border-2 border-amber-300 rounded-lg px-4 py-2 hover:bg-amber-300/10 transition-colors cursor-pointer"
        @click="loadMore()"
      >
        Carregar mais
      </button>
      <span class="text-gray-300 text-sm">
        {{ itemsToShow.length }} de {{ props.walletTransactions.length }}
        transações
      </span>
    </div>

    <span class="font-bold text-gray-300" v-if="itemsToShow.length == 0">
      Não há nenhuma transação anterior
    </span>
  </div>
</template>

<style scoped>
/* Minimal styles - most styles moved to child components */
</style>

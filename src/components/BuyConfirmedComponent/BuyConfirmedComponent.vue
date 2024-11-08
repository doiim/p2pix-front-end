<script setup lang="ts">
import { withdrawDeposit } from "@/blockchain/buyerMethods";
import {
  getActiveLockAmount,
  listAllTransactionByWalletAddress,
  listValidDepositTransactionsByWalletAddress,
} from "@/blockchain/wallet";
import CustomButton from "@/components/CustomButton/CustomButton.vue";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import { useEtherStore } from "@/store/ether";
import { storeToRefs } from "pinia";
import { onMounted, ref, watch } from "vue";
import ListingComponent from "../ListingComponent/ListingComponent.vue";

// props
const props = defineProps<{
  tokenAmount: number | undefined;
  isCurrentStep: boolean;
}>();

const etherStore = useEtherStore();
const { walletAddress } = storeToRefs(etherStore);

const lastWalletTransactions = ref<WalletTransaction[]>([]);
const depositList = ref<ValidDeposit[]>([]);
const activeLockAmount = ref<number>(0);

// methods

const getWalletTransactions = async () => {
  etherStore.setLoadingWalletTransactions(true);
  if (walletAddress.value) {
    const walletDeposits = await listValidDepositTransactionsByWalletAddress(
      walletAddress.value
    );

    const allUserTransactions = await listAllTransactionByWalletAddress(
      walletAddress.value
    );

    activeLockAmount.value = await getActiveLockAmount(walletAddress.value);

    if (walletDeposits) {
      depositList.value = walletDeposits;
    }
    if (allUserTransactions) {
      lastWalletTransactions.value = allUserTransactions;
    }
  }
  etherStore.setLoadingWalletTransactions(false);
};

const callWithdraw = async (amount: string) => {
  if (amount) {
    etherStore.setLoadingWalletTransactions(true);
    const withdraw = await withdrawDeposit(amount, etherStore.selectedToken);
    if (withdraw) {
      console.log("Saque realizado!");
      await getWalletTransactions();
    } else {
      console.log("Não foi possível realizar o saque!");
    }
    etherStore.setLoadingWalletTransactions(false);
  }
};

// Emits
const emit = defineEmits(["makeAnotherTransaction"]);

// observer
watch(props, async (): Promise<void> => {
  if (props.isCurrentStep) await getWalletTransactions();
});

onMounted(async () => {
  await getWalletTransactions();
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold sm:text-5xl text-xl max-w-[50rem]"
        >Os tokens já foram transferidos <br />
        para a sua carteira!
      </span>
    </div>
    <div class="main-container">
      <div
        class="flex flex-col w-full bg-white px-10 py-5 rounded-lg border-y-10"
      >
        <div>
          <p>Tokens recebidos</p>
          <p class="text-2xl text-gray-900">
            {{ props.tokenAmount }} {{ etherStore.selectedToken }}
          </p>
        </div>
        <div class="my-5">
          <p class="text-sm">
            <b>Não encontrou os tokens? </b><br />Clique no botão abaixo para
            <br />
            cadastrar o {{ etherStore.selectedToken }} em sua carteira.
          </p>
        </div>
        <CustomButton :text="'Cadastrar token'" @buttonClicked="() => {}" />
      </div>
      <button
        type="button"
        class="border-amber-500 border-2 rounded default-button text-white p-2 px-50 min-w-[198px]"
        @click="emit('makeAnotherTransaction')"
      >
        Fazer nova transação
      </button>
    </div>
    <div
      class="flex justify-center mt-8 mb-6 text-white text-xl md:text-3xl font-bold"
    >
      Gerenciar transações
    </div>
    <div class="w-full max-w-xs md:max-w-lg">
      <ListingComponent
        :valid-deposits="depositList"
        :wallet-transactions="lastWalletTransactions"
        :active-lock-amount="activeLockAmount"
        @deposit-withdrawn="callWithdraw"
      ></ListingComponent>
    </div>
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

p {
  @apply text-gray-900;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.text {
  @apply text-white text-center;
}

.last-release-info {
  @apply font-medium text-base text-gray-900;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

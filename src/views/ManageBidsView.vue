<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useViemStore } from "@/store/viem";
import ListingComponent from "@/components/ListingComponent/ListingComponent.vue";
import LoadingComponent from "@/components/LoadingComponent/LoadingComponent.vue";
import CustomAlert from "@/components/CustomAlert/CustomAlert.vue";
import {
  listValidDepositTransactionsByWalletAddress,
  listAllTransactionByWalletAddress,
  getActiveLockAmount,
} from "@/blockchain/wallet";
import { withdrawDeposit } from "@/blockchain/buyerMethods";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";

import router from "@/router/index";
import { storeToRefs } from "pinia";

const viemStore = useViemStore();
const { walletAddress, networkName, selectedToken } = storeToRefs(viemStore);
const loadingWithdraw = ref<boolean>(false);
const showAlert = ref<boolean>(false);

const depositList = ref<ValidDeposit[]>([]);
const transactionsList = ref<WalletTransaction[]>([]);
const activeLockAmount = ref<number>(0);

const callWithdraw = async (amount: string) => {
  if (amount) {
    loadingWithdraw.value = true;
    let withdraw;
    try {
      withdraw = await withdrawDeposit(amount, selectedToken.value);
    } catch {
      loadingWithdraw.value = false;
    }

    if (withdraw) {
      console.log("Saque realizado!");
      await getWalletTransactions();
      showAlert.value = true;
    } else {
      console.log("Não foi possível realizar o saque!");
    }
    loadingWithdraw.value = false;
  }
};

const getWalletTransactions = async () => {
  viemStore.setLoadingWalletTransactions(true);
  if (walletAddress.value) {
    console.log("Will fetch all required data...");
    const walletDeposits = await listValidDepositTransactionsByWalletAddress(
      walletAddress.value
    );
    console.log("Fetched deposits");

    const allUserTransactions = await listAllTransactionByWalletAddress(
      walletAddress.value
    );
    console.log("Fetched all transactions");

    activeLockAmount.value = await getActiveLockAmount(walletAddress.value);
    console.log("Fetched active lock amount");

    if (walletDeposits) {
      depositList.value = walletDeposits;
    }
    if (allUserTransactions) {
      transactionsList.value = allUserTransactions;
    }
  }
  viemStore.setLoadingWalletTransactions(false);
};

onMounted(async () => {
  if (!walletAddress.value) {
    router.push({ name: "home" });
  }
  await getWalletTransactions();
});

watch(walletAddress, async () => {
  await getWalletTransactions();
});

watch(networkName, async () => {
  await getWalletTransactions();
});
</script>

<template>
  <div>
    <CustomAlert
      v-if="showAlert"
      :type="'withdraw'"
      @close-alert="showAlert = false"
    />
    <div class="page">
      <div class="header" v-if="!loadingWithdraw && !walletAddress">
        Por Favor Conecte Sua Carteira
      </div>
      <div class="header" v-if="!loadingWithdraw && walletAddress">
        Gerenciar Ofertas
      </div>
      <div class="w-full max-w-4xl flex justify-center">
        <ListingComponent
          v-if="!loadingWithdraw && walletAddress"
          :valid-deposits="depositList"
          :wallet-transactions="transactionsList"
          :active-lock-amount="activeLockAmount"
          @deposit-withdrawn="callWithdraw"
        ></ListingComponent>
        <LoadingComponent
          v-if="loadingWithdraw"
          :message="'A transação está sendo enviada para a rede. Em breve os tokens serão depositados em sua carteira.'"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center gap-10 mt-20 w-full;
}

.header {
  @apply text-3xl text-white leading-9 font-bold justify-center flex;
}
</style>

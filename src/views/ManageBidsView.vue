<script setup lang="ts">
import { useEtherStore } from "@/store/ether";
import { storeToRefs } from "pinia";
import ListingComponent from "@/components/ListingComponent/ListingComponent.vue";
import LoadingComponent from "@/components/LoadingComponent/LoadingComponent.vue";
import CustomAlert from "@/components/CustomAlert/CustomAlert.vue";
import { ref, watch, onMounted } from "vue";
import {
  listValidDepositTransactionsByWalletAddress,
  listAllTransactionByWalletAddress,
  getActiveLockAmount,
} from "@/blockchain/wallet";
import { withdrawDeposit } from "@/blockchain/buyerMethods";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";

import router from "@/router/index";

const etherStore = useEtherStore();
const { walletAddress, networkName, selectedToken } = storeToRefs(etherStore);
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
      transactionsList.value = allUserTransactions;
    }
  }
  etherStore.setLoadingWalletTransactions(false);
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
      <div class="w-full max-w-4xl">
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

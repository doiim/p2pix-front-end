<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import ListingComponent from '@/components/ListingComponent/ListingComponent.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import {
  listValidDepositTransactionsByWalletAddress,
  listAllTransactionByWalletAddress,
  getSellerLockState,
  getExpiredLockIds,
  sweepExpiredLocks,
} from '@/blockchain/wallet';
import { withdrawDeposit } from '@/blockchain/buyerMethods';
import { getCurrentAccount } from '@/blockchain/provider';
import type { ValidDeposit } from '@/model/ValidDeposit';
import type { WalletTransaction } from '@/model/WalletTransaction';

import router from '@/router/index';

const user = useUser();
const { walletAddress, network, selectedToken } = user;
const loadingWithdraw = ref<boolean>(false);
const showAlert = ref<boolean>(false);
const showSweepAlert = ref<boolean>(false);
const showSweepEmptyAlert = ref<boolean>(false);
const showSweepErrorAlert = ref<boolean>(false);
const loadingSweep = ref<boolean>(false);

const depositList = ref<ValidDeposit[]>([]);
const transactionsList = ref<WalletTransaction[]>([]);
const activeLockAmount = ref<number>(0);
const expiredLockIds = ref<bigint[]>([]);

const callWithdraw = async (amount: string) => {
  if (amount) {
    loadingWithdraw.value = true;
    let withdraw;
    try {
      // `withdraw` runs `unlockExpired` on-chain, which reverts on any id
      // that is no longer expired (released, or already swept by a third
      // party). Re-read at send time so a stale page-load snapshot cannot
      // brick the seller's own withdrawal.
      const expiredLocks = walletAddress.value
        ? ((await getExpiredLockIds(walletAddress.value)) ?? [])
        : [];
      withdraw = await withdrawDeposit(
        amount,
        network.value.tokens[selectedToken.value].address,
        expiredLocks,
      );
    } catch {
      loadingWithdraw.value = false;
    }

    if (withdraw) {
      console.log('Saque realizado!');
      await getWalletTransactions();
      showAlert.value = true;
    } else {
      console.log('Não foi possível realizar o saque!');
    }
    loadingWithdraw.value = false;
  }
};

const callSweepExpired = async () => {
  if (loadingSweep.value || !walletAddress.value) {
    return;
  }

  loadingSweep.value = true;
  try {
    const swept = await sweepExpiredLocks(
      walletAddress.value,
      network.value.tokens[selectedToken.value].address,
    );
    await getWalletTransactions();
    if (swept > 0) {
      showSweepAlert.value = true;
    } else {
      showSweepEmptyAlert.value = true;
    }
  } catch (error) {
    showSweepErrorAlert.value = true;
    console.log('Não foi possível recuperar as reservas expiradas!', error);
  } finally {
    loadingSweep.value = false;
  }
};

const getWalletTransactions = async () => {
  user.setLoadingWalletTransactions(true);
  if (walletAddress.value) {
    const walletDeposits = await listValidDepositTransactionsByWalletAddress(
      walletAddress.value,
    );

    const allUserTransactions = await listAllTransactionByWalletAddress(
      walletAddress.value,
    );

    // One subgraph + `getLocksStatus` read feeds both figures; fetching them
    // separately (getActiveLockAmount then getExpiredLockIds) doubled it.
    const { activeLockAmount: lockAmount, expiredLockIds: expiredIds } =
      await getSellerLockState(walletAddress.value);
    activeLockAmount.value = lockAmount;
    expiredLockIds.value = expiredIds;

    if (walletDeposits) {
      depositList.value = walletDeposits;
    }
    if (allUserTransactions) {
      transactionsList.value = allUserTransactions;
    }
  }
  user.setLoadingWalletTransactions(false);
};

onMounted(async () => {
  // walletAddress resolves one await after mount, so the connector's own
  // address is what tells a reload apart from a genuinely absent wallet.
  if (!getCurrentAccount().address) {
    router.push({ name: 'home' });
    return;
  }
  await getWalletTransactions();
});

watch(walletAddress, async () => {
  await getWalletTransactions();
});

watch(network, async () => {
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
    <CustomAlert
      v-if="showSweepAlert"
      :type="'sweep'"
      @close-alert="showSweepAlert = false"
    />
    <CustomAlert
      v-if="showSweepEmptyAlert"
      :type="'sweepEmpty'"
      @close-alert="showSweepEmptyAlert = false"
    />
    <CustomAlert
      v-if="showSweepErrorAlert"
      :type="'sweepError'"
      @close-alert="showSweepErrorAlert = false"
    />
    <div class="page">
      <div class="header" v-if="!loadingWithdraw && !walletAddress">
        Por favor, conecte sua carteira
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
          :expired-locks-count="expiredLockIds.length"
          @deposit-withdrawn="callWithdraw"
          @sweep-expired="callSweepExpired"
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
@reference "tailwindcss";
.page {
  @apply flex flex-col items-center gap-10 mt-20 w-full;
}

.header {
  @apply text-3xl text-white leading-9 font-bold justify-center flex;
}
</style>

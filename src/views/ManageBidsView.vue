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
const alertType = ref<
  'withdraw' | 'withdrawError' | 'sweep' | 'sweepEmpty' | 'sweepError' | null
>(null);
const loadingSweep = ref<boolean>(false);

const depositList = ref<ValidDeposit[]>([]);
const transactionsList = ref<WalletTransaction[]>([]);
const activeLockAmount = ref<number>(0);
const expiredLockIds = ref<bigint[]>([]);

const callWithdraw = async (amount: string) => {
  if (!amount) return;

  loadingWithdraw.value = true;
  try {
    // `withdraw` runs `unlockExpired` on-chain, which reverts on any id that is
    // no longer expired. Re-reading at send time drops ids a stale page-load
    // snapshot still holds; a third-party sweep landing between this read and
    // the tx still reverts, and shows as a failed withdrawal.
    const expiredLocks = walletAddress.value
      ? ((await getExpiredLockIds(walletAddress.value)) ?? [])
      : [];
    const withdrawn = await withdrawDeposit(
      amount,
      network.value.tokens[selectedToken.value].address,
      expiredLocks,
    );
    alertType.value = withdrawn ? 'withdraw' : 'withdrawError';
  } catch (error) {
    alertType.value = 'withdrawError';
    console.error('Não foi possível realizar o saque!', error);
  } finally {
    loadingWithdraw.value = false;
  }
  await getWalletTransactions().catch(console.error);
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
    alertType.value = swept > 0 ? 'sweep' : 'sweepEmpty';
  } catch (error) {
    alertType.value = 'sweepError';
    console.error('Não foi possível recuperar as reservas expiradas!', error);
  } finally {
    loadingSweep.value = false;
  }
  await getWalletTransactions().catch(console.error);
};

const getWalletTransactions = async () => {
  user.setLoadingWalletTransactions(true);
  try {
    if (walletAddress.value) {
      const walletDeposits = await listValidDepositTransactionsByWalletAddress(
        walletAddress.value,
      );

      const allUserTransactions = await listAllTransactionByWalletAddress(
        walletAddress.value,
      );

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
  } finally {
    user.setLoadingWalletTransactions(false);
  }
};

onMounted(async () => {
  // walletAddress resolves one await after mount, so the connector's own
  // address is what tells a reload apart from a genuinely absent wallet.
  if (!getCurrentAccount().address) {
    router.push({ name: 'home' });
    return;
  }
  await getWalletTransactions().catch(console.error);
});

watch(walletAddress, () => {
  getWalletTransactions().catch(console.error);
});

watch(network, () => {
  getWalletTransactions().catch(console.error);
});
</script>

<template>
  <div>
    <CustomAlert
      v-if="alertType"
      :key="alertType"
      :type="alertType"
      @close-alert="alertType = null"
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
          :sweeping="loadingSweep"
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

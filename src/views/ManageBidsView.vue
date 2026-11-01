<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useUser } from '@/composables/useUser';
import ListingComponent from '@/components/ListingComponent/ListingComponent.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import {
  useSellerLockStateQuery,
  useWalletDepositsQuery,
  useWalletAddress,
  useWalletTransactionsQuery,
} from '@/queries/wallet';
import {
  useSweepExpiredLocksMutation,
  useWithdrawDepositMutation,
} from '@/queries/mutations';
import { getCurrentAccount } from '@/blockchain/provider';

import router from '@/router/index';

const user = useUser();
const { network, selectedToken } = user;
const walletAddress = useWalletAddress();
const alertType = ref<
  'withdraw' | 'withdrawError' | 'sweep' | 'sweepEmpty' | 'sweepError' | null
>(null);

const depositsQuery = useWalletDepositsQuery(
  network,
  selectedToken,
  walletAddress,
);
const transactionsQuery = useWalletTransactionsQuery(network, walletAddress);
const lockStateQuery = useSellerLockStateQuery(network, walletAddress);
const withdrawMutation = useWithdrawDepositMutation();
const sweepMutation = useSweepExpiredLocksMutation();

const depositList = computed(() => depositsQuery.data.value ?? []);
const transactionsList = computed(() => transactionsQuery.data.value ?? []);
const activeLockAmount = computed(
  () => lockStateQuery.data.value?.activeLockAmount ?? 0,
);
const expiredLocksCount = computed(
  () => lockStateQuery.data.value?.expiredLockIds.length ?? 0,
);
const loadingWithdraw = computed(() => withdrawMutation.isPending.value);
const loadingSweep = computed(() => sweepMutation.isPending.value);
const loadingWalletTransactions = computed(
  () =>
    depositsQuery.isPending.value ||
    transactionsQuery.isPending.value ||
    lockStateQuery.isPending.value,
);

const callWithdraw = async (amount: string) => {
  if (!amount || !walletAddress.value) return;

  try {
    const withdrawn = await withdrawMutation.mutateAsync({
      amount,
      seller: walletAddress.value,
      network: network.value,
      token: network.value.tokens[selectedToken.value].address,
    });
    alertType.value = withdrawn ? 'withdraw' : 'withdrawError';
  } catch (error) {
    alertType.value = 'withdrawError';
    console.error('Não foi possível realizar o saque!', error);
  }
};

const callSweepExpired = async () => {
  if (loadingSweep.value || !walletAddress.value) return;

  try {
    const swept = await sweepMutation.mutateAsync({
      seller: walletAddress.value,
      network: network.value,
    });
    alertType.value = swept > 0 ? 'sweep' : 'sweepEmpty';
  } catch (error) {
    alertType.value = 'sweepError';
    console.error('Não foi possível recuperar as reservas expiradas!', error);
  }
};

onMounted(() => {
  // walletAddress resolves one await after mount, so the connector's own
  // address is what tells a reload apart from a genuinely absent wallet.
  if (!getCurrentAccount().address) {
    router.push({ name: 'home' });
  }
});
</script>

<template>
  <div>
    <CustomAlert
      v-if="alertType"
      :key="alertType"
      class="mx-auto mt-10 max-w-lg"
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
          :loading="loadingWalletTransactions"
          :expired-locks-count="expiredLocksCount"
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

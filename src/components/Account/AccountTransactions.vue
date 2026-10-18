<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import { listAllTransactionByWalletAddress } from '@/blockchain/wallet';
import type { WalletTransaction } from '@/model/WalletTransaction';
import ListingComponent from '@/components/ListingComponent/ListingComponent.vue';

const user = useUser();
const transactions = ref<WalletTransaction[]>([]);

watch(
  [user.walletAddress, user.network],
  async ([address], _, onCleanup) => {
    // Drop the result if the account or network changed while reading.
    let stale = false;
    onCleanup(() => (stale = true));
    transactions.value = [];
    if (!address) return;
    const list = await listAllTransactionByWalletAddress(address);
    if (!stale) transactions.value = list;
  },
  { immediate: true },
);
</script>

<template>
  <ListingComponent
    v-if="transactions.length"
    :valid-deposits="[]"
    :wallet-transactions="transactions"
    :active-lock-amount="0"
  />
</template>

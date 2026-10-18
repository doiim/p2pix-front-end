<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatEther } from 'viem';
import { useUser } from '@/composables/useUser';
import { getTokenBalances } from '@/blockchain/wallet';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';

const user = useUser();
const tokenBalances = ref<Awaited<ReturnType<typeof getTokenBalances>>>([]);

watch(
  [user.walletAddress, user.network],
  async ([address], _, onCleanup) => {
    // Drop the result if the account or network changed while reading.
    let stale = false;
    onCleanup(() => (stale = true));
    const balances = address ? await getTokenBalances(address) : [];
    if (!stale) tokenBalances.value = balances;
  },
  { immediate: true },
);

const rows = computed(() => {
  if (!user.walletAddress.value) return [];
  const network = user.network.value;
  return [
    {
      symbol: network.nativeCurrency.symbol,
      image: getNetworkImage(network.name),
      amount: Number(user.balance.value),
    },
    ...tokenBalances.value.map((balance) => ({
      symbol: balance.token,
      image: getTokenImage(balance.token),
      amount: Number(formatEther(balance.amount)),
    })),
  ].filter((row) => row.amount > 0);
});
</script>

<template>
  <section
    v-if="rows.length"
    class="main-container lg:max-w-90"
    aria-labelledby="account-balances-title"
  >
    <div class="w-full bg-white rounded-lg p-5">
      <h2 id="account-balances-title" class="text-sm font-medium text-gray-600">
        Saldos
      </h2>
      <ul class="flex flex-col gap-3 mt-4">
        <li
          v-for="row in rows"
          :key="row.symbol"
          class="flex items-center gap-3 font-semibold text-gray-900"
        >
          <img :src="row.image" alt="" class="w-6 h-6" />
          <span class="flex-1">{{ row.symbol }}</span>
          <span>
            {{
              row.amount.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })
            }}
          </span>
        </li>
      </ul>
    </div>
  </section>
</template>

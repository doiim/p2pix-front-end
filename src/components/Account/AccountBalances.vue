<script setup lang="ts">
import { ref, watch } from 'vue';
import { formatEther, formatUnits } from 'viem';
import { getTokenBalances } from '@doiim/passkeys/smart-account';
import { useUser } from '@/composables/useUser';
import { getPublicClient } from '@/blockchain/provider';
import { TokenEnum } from '@/model/NetworkEnum';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';

const user = useUser();
const tokens = Object.values(TokenEnum);
const rows = ref<{ symbol: string; image: string; amount: number }[]>([]);

watch(
  [user.walletAddress, user.network],
  async ([address, network], _, onCleanup) => {
    // Drop the result if the account or network changed while reading.
    let stale = false;
    onCleanup(() => (stale = true));
    rows.value = [];
    if (!address) return;
    const balances = await getTokenBalances(
      getPublicClient(),
      address,
      tokens.map((token) => network.tokens[token].address),
    );
    if (stale) return;
    rows.value = [
      {
        symbol: network.nativeCurrency.symbol,
        image: getNetworkImage(network.name),
        amount: Number(formatEther(balances.eth)),
      },
      ...balances.tokens.map((balance, index) => ({
        symbol: tokens[index],
        image: getTokenImage(tokens[index]),
        amount: Number(formatUnits(balance.balance, balance.decimals)),
      })),
    ].filter((row) => row.amount > 0);
  },
  { immediate: true },
);
</script>

<template>
  <div v-if="rows.length" class="main-container lg:max-w-90!">
    <div class="w-full bg-white rounded-lg p-5">
      <h2 class="text-sm font-medium text-gray-600">Saldos</h2>
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
  </div>
</template>

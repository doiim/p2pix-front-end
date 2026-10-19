<script setup lang="ts">
import { ref, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import { listAllTransactionByWalletAddress } from '@/blockchain/wallet';
import type { WalletTransaction } from '@/model/WalletTransaction';
import { LockStatus } from '@/model/LockStatus';
import { getTokenImage } from '@/utils/imagesPath';
import ChevronDown from '@/assets/chevronDown.svg';

const EVENTS: Record<string, { title: string; sign: string }> = {
  LockReleased: { title: 'Comprado com Pix', sign: '+' },
  LockAdded: { title: 'Compra iniciada', sign: '' },
  DepositAdded: { title: 'Oferta criada', sign: '−' },
  DepositWithdrawn: { title: 'Oferta retirada', sign: '+' },
  Sent: { title: 'Enviado', sign: '−' },
  Received: { title: 'Recebido', sign: '+' },
};

const user = useUser();
const transactions = ref<WalletTransaction[]>([]);
const openIndex = ref(-1);

watch(
  [user.walletAddress, user.network],
  async ([address], _, onCleanup) => {
    // Drop the result if the account or network changed while reading.
    let stale = false;
    onCleanup(() => (stale = true));
    transactions.value = [];
    if (!address) return;
    const list = await listAllTransactionByWalletAddress(address);
    // A purchase only gets its own row while it can still be continued.
    if (!stale)
      transactions.value = list.filter(
        (transaction) =>
          transaction.event !== 'LockAdded' ||
          transaction.lockStatus === LockStatus.Active,
      );
  },
  { immediate: true },
);

const date = (transaction: WalletTransaction) =>
  new Date((transaction.blockTimestamp ?? 0) * 1000);

const month = (transaction: WalletTransaction) =>
  date(transaction).toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
</script>

<template>
  <section
    v-if="transactions.length"
    class="w-full flex flex-col px-4 sm:px-6 pt-4 pb-2 rounded-lg bg-white"
  >
    <h3 class="text-base font-bold text-gray-900">Histórico</h3>
    <ul>
      <li
        v-for="(transaction, index) in transactions"
        :key="index"
        class="border-b border-gray-100 last:border-b-0"
      >
        <span
          v-if="
            index === 0 || month(transactions[index - 1]) !== month(transaction)
          "
          class="block mt-2 text-xs font-semibold text-gray-600 first-letter:uppercase"
        >
          {{ month(transaction) }}
        </span>
        <button
          type="button"
          :aria-expanded="openIndex === index"
          class="flex items-center gap-3 w-full min-h-15 py-2.5 rounded-lg text-left text-gray-900 hover:bg-gray-100 transition-colors"
          @click="openIndex = openIndex === index ? -1 : index"
        >
          <img
            :src="getTokenImage(transaction.token)"
            alt=""
            class="w-8 h-8 rounded-full"
          />
          <span class="flex flex-col flex-1 min-w-0">
            <span class="text-sm font-semibold truncate">
              {{ EVENTS[transaction.event]?.title ?? transaction.event }}
            </span>
            <span class="text-xs text-gray-500">
              {{
                date(transaction)
                  .toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  .replace(', ', ' · ')
              }}
            </span>
          </span>
          <span
            v-if="transaction.amount >= 0"
            class="text-sm font-semibold whitespace-nowrap"
          >
            {{ EVENTS[transaction.event]?.sign }}
            {{
              transaction.amount.toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 6,
              })
            }}
            {{ transaction.token }}
          </span>
          <ChevronDown
            aria-hidden="true"
            class="shrink-0 text-gray-500 transition-transform"
            :class="{ 'rotate-180': openIndex === index }"
          />
        </button>
        <div v-if="openIndex === index" class="flex gap-4 pl-11 pb-3 text-sm">
          <a
            :href="`${user.network.value.blockExplorers?.default.url}/tx/${transaction.transactionHash}`"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium text-indigo-800 underline"
          >
            Ver no {{ user.network.value.blockExplorers?.default.name }}
          </a>
          <RouterLink
            v-if="transaction.lockStatus === LockStatus.Active"
            :to="{
              path: `/${transaction.transactionID}`,
              state: { lockID: transaction.transactionID },
            }"
            class="font-medium text-indigo-800 underline"
          >
            Continuar compra
          </RouterLink>
        </div>
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useUser } from '@/composables/useUser';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';
import { NATIVE_TOKEN } from '@/model/NetworkEnum';
import { sendableTokens } from '@/config/networks';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import AccountEmptyState from './AccountEmptyState.vue';

const account = usePasskeyAccount();
const user = useUser();

const rows = computed(() =>
  sendableTokens(user.network.value).map((token) => ({
    symbol: account.symbolOf(token),
    image:
      token === NATIVE_TOKEN
        ? getNetworkImage(user.network.value.name)
        : getTokenImage(token),
    text: formatTokenAmount(
      account.balanceOf(token),
      account.decimalsOf(token),
    ),
  })),
);
const isEmpty = computed(() =>
  sendableTokens(user.network.value).every(
    (token) => account.balanceOf(token) === 0n,
  ),
);
</script>

<template>
  <p
    v-if="account.error.value && !account.balancesLoaded.value"
    class="acct-empty text-red-500"
  >
    {{ account.error.value }}
  </p>
  <p v-else-if="!account.balancesLoaded.value" class="acct-empty">
    Carregando…
  </p>
  <AccountEmptyState
    v-else-if="isEmpty"
    message="Sua conta ainda não tem saldo."
  />
  <ul v-else class="divide-y divide-gray-200">
    <li v-for="row in rows" :key="row.symbol" class="acct-row">
      <img :src="row.image" :alt="row.symbol" class="h-6 w-6" />
      <span class="flex-1 text-sm font-semibold text-gray-900">
        {{ row.symbol }}
      </span>
      <span class="text-sm text-gray-900">{{ row.text }}</span>
    </li>
  </ul>
</template>

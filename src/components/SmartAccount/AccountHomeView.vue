<script setup lang="ts">
import { computed } from 'vue';
import DepositIcon from '@/assets/deposit.svg';
import SendIcon from '@/assets/send.svg';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { TokenEnum } from '@/model/NetworkEnum';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { formatBrlFixed } from '@/utils/reputation';

// Price in R$ cents per whole token. BRZ is pegged to the real; an asset
// without a price shows no R$ value, and then the total is hidden too.
const BRL_CENTS: Partial<Record<TokenEnum, bigint>> = { [TokenEnum.BRZ]: 100n };

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();

// Only the held assets.
const rows = computed(() =>
  account.assets.value
    .filter((asset) => account.balanceOf(asset.token) > 0n)
    .map((asset) => {
      const amount = account.balanceOf(asset.token);
      const decimals = account.decimalsOf(asset.token);
      const price = asset.token && BRL_CENTS[asset.token];
      return {
        ...asset,
        text: formatTokenAmount(amount, decimals),
        cents: price ? (amount * price) / 10n ** BigInt(decimals) : null,
      };
    }),
);
const total = computed(() =>
  rows.value.every((row) => row.cents !== null)
    ? rows.value.reduce((sum, row) => sum + (row.cents ?? 0n), 0n)
    : null,
);
</script>

<template>
  <div v-if="account.balancesLoaded.value && total !== null">
    <p class="text-sm text-gray-600">Saldo total</p>
    <p class="text-xl font-semibold text-gray-900">
      ~ R$ {{ formatBrlFixed(total) }}
    </p>
  </div>
  <div class="grid grid-cols-2 gap-2">
    <button
      type="button"
      class="account-button"
      @click="accountRouter.push('receive')"
    >
      <DepositIcon aria-hidden="true" />
      Depositar
    </button>
    <button
      type="button"
      class="account-button"
      :disabled="account.busy.value"
      @click="accountRouter.push('send')"
    >
      <SendIcon aria-hidden="true" />
      Enviar
    </button>
  </div>
  <div class="pt-2 border-t border-gray-200">
    <p
      v-if="account.error.value && !account.balancesLoaded.value"
      class="acct-empty text-red-500"
    >
      Não foi possível ler o saldo.
    </p>
    <p v-else-if="!account.balancesLoaded.value" class="acct-empty">
      Carregando…
    </p>
    <p v-else-if="!rows.length" class="acct-empty">
      Sua conta ainda não tem saldo.
    </p>
    <ul v-else>
      <li
        v-for="row in rows"
        :key="row.token ?? 'native'"
        class="flex items-center gap-3 py-2 text-gray-900"
      >
        <img :src="row.image" :alt="row.symbol" class="w-6 h-6" />
        <span class="flex-1 font-semibold">{{ row.symbol }}</span>
        <span class="flex flex-col items-end font-semibold">
          {{ row.text }} {{ row.symbol }}
          <span
            v-if="row.cents !== null"
            class="text-xs font-normal text-gray-500"
          >
            ~ R$ {{ formatBrlFixed(row.cents) }}
          </span>
        </span>
      </li>
    </ul>
  </div>
</template>

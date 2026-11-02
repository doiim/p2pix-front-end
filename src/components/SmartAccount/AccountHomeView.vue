<script setup lang="ts">
import { computed } from 'vue';
import DepositIcon from '@/assets/deposit.svg';
import SendIcon from '@/assets/send.svg';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useUser } from '@/composables/useUser';
import { TokenEnum } from '@/model/NetworkEnum';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';
import { formatBrlFixed } from '@/utils/reputation';

// Price in R$ cents per whole token. BRZ is pegged to the real; an asset
// without a price shows no R$ value, and then the total is hidden too.
const BRL_CENTS: Partial<Record<TokenEnum, bigint>> = { [TokenEnum.BRZ]: 100n };

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const user = useUser();

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
  rows.value.length && rows.value.every((row) => row.cents !== null)
    ? rows.value.reduce((sum, row) => sum + (row.cents ?? 0n), 0n)
    : null,
);

// Funds the account holds on the networks other than the selected one.
const elsewhere = computed(() =>
  (account.discovered.value?.holdings ?? [])
    .filter((holding) => holding.network.id !== user.network.value.id)
    .flatMap((holding) =>
      holding.tokens.map((token) => ({
        key: `${holding.network.id}:${token.symbol}`,
        symbol: token.symbol,
        network: holding.network.name,
        image: token.address
          ? getTokenImage(token.symbol)
          : getNetworkImage(holding.network.name),
        text: formatTokenAmount(token.balance, token.decimals),
      })),
    ),
);
// The selected network has its own read, and its own error above.
const failedNetworks = computed(() =>
  (account.discovered.value?.failed ?? [])
    .filter((network) => network.id !== user.network.value.id)
    .map((network) => network.name),
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
      v-if="account.balanceError.value && !account.balancesLoaded.value"
      class="acct-empty text-red-500"
    >
      Não foi possível ler o saldo.
    </p>
    <!-- An empty account is only empty once the other networks were read. -->
    <p
      v-else-if="
        !account.balancesLoaded.value ||
        (!rows.length && !account.discovered.value)
      "
      class="acct-empty"
    >
      Carregando…
    </p>
    <p
      v-else-if="!rows.length && !elsewhere.length && !failedNetworks.length"
      class="acct-empty"
    >
      Sua conta ainda não tem saldo.
    </p>
    <ul v-else-if="rows.length">
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
    <template v-if="elsewhere.length">
      <p class="acct-label pt-2">Em outras redes</p>
      <ul>
        <li
          v-for="row in elsewhere"
          :key="row.key"
          class="flex items-center gap-3 py-2 text-gray-900"
        >
          <img :src="row.image" :alt="row.symbol" class="w-6 h-6" />
          <span class="flex-1 font-semibold">
            {{ row.symbol }}
            <span class="font-normal text-gray-500">· {{ row.network }}</span>
          </span>
          <span class="font-semibold">{{ row.text }} {{ row.symbol }}</span>
        </li>
      </ul>
    </template>
    <p
      v-if="account.balanceError.value && account.balancesLoaded.value"
      class="pt-2 text-sm text-gray-500"
    >
      Saldo desatualizado
    </p>
    <p v-if="failedNetworks.length" class="pt-2 text-sm text-red-500">
      Não foi possível ler o saldo de: {{ failedNetworks.join(', ') }}
    </p>
  </div>
</template>

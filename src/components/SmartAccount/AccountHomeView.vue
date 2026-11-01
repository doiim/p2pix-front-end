<script setup lang="ts">
import { computed } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useConnection } from '@wagmi/vue';
import DepositIcon from '@/assets/deposit.svg';
import SendIcon from '@/assets/withdraw.svg';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useBackupPasskey } from '@/composables/useBackupPasskey';
import { useUser } from '@/composables/useUser';
import { priceInBrz } from '@/blockchain/prices';
import { TokenEnum } from '@/model/NetworkEnum';
import { queryKeyRoots } from '@/queries/keys';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';
import { formatBrlFixed } from '@/utils/reputation';
import { exportPrivateKey, MAGIC_CONNECTOR_ID } from '@/wallet/magic';

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const backup = useBackupPasskey();
const user = useUser();
const connection = useConnection();
const isMagic = computed(
  () => connection.connector.value?.id === MAGIC_CONNECTOR_ID,
);

const run = async (task: () => Promise<void>, done?: string) => {
  try {
    await task();
    if (done) user.showToast('success', done);
  } catch (cause) {
    user.showToast(
      'error',
      cause instanceof Error ? cause.message : 'Algo deu errado',
    );
  }
};

// Only the held assets, in asset order (BRZ, swap tokens, native). Only these
// are priced: a quote for a token the account lacks would reach CoW for nothing.
const held = computed(() =>
  account.assets.value.filter((asset) => account.balanceOf(asset.token) > 0n),
);

// BRZ base units per whole token, by symbol ('' = native); null = no price.
// The cache lives in priceInBrz, so a refetch within 60 s costs nothing.
const prices = useQuery({
  queryKey: computed(() => [
    ...queryKeyRoots.passkeyPrices,
    user.network.value.id,
    ...held.value.map((asset) => asset.token ?? ''),
  ]),
  queryFn: async () => {
    const entries = await Promise.all(
      held.value.map(
        async (asset) =>
          [
            asset.token ?? '',
            await priceInBrz(user.network.value, asset.token),
          ] as const,
      ),
    );
    return new Map(entries);
  },
  enabled: account.balancesLoaded,
  staleTime: 60_000,
});

// R$ cents of `amount`; BRZ is the real, so BRZ base units / 10^(brz - 2).
const toCents = (amount: bigint, decimals: number, price: bigint) =>
  (amount * price) /
  10n ** BigInt(decimals + account.decimalsOf(TokenEnum.BRZ) - 2);

const rows = computed(() =>
  held.value.map((asset) => {
    const amount = account.balanceOf(asset.token);
    const decimals = account.decimalsOf(asset.token);
    const price = prices.data.value?.get(asset.token ?? '') ?? null;
    return {
      ...asset,
      text: formatTokenAmount(amount, decimals, asset.token ? 2 : 6),
      cents: price === null ? null : toCents(amount, decimals, price),
    };
  }),
);
// Rows without a price are left out of the sum; no priced row, no total.
const total = computed(() => {
  const priced = rows.value.flatMap((row) =>
    row.cents === null ? [] : [row.cents],
  );
  return priced.length ? priced.reduce((sum, cents) => sum + cents, 0n) : null;
});

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
      v-if="account.error.value && !account.balancesLoaded.value"
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
    <p v-else-if="!rows.length && !elsewhere.length" class="acct-empty">
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
    <p v-if="failedNetworks.length" class="pt-2 text-sm text-red-500">
      Não foi possível ler o saldo de: {{ failedNetworks.join(', ') }}
    </p>
  </div>
  <div
    v-if="isMagic"
    class="flex flex-col gap-2 pt-2 border-t border-gray-200 text-xs"
  >
    <p v-if="backup.needsBackup.value" class="text-amber-700">
      Sua conta ainda não tem passkey de backup nesta rede (cada rede precisa da
      sua).
    </p>
    <div class="flex flex-wrap gap-x-4 gap-y-2">
      <button
        v-if="backup.needsBackup.value"
        type="button"
        class="acct-link"
        :disabled="backup.installing.value"
        @click="
          run(
            backup.install,
            `Passkey de backup adicionada na rede ${user.network.value.name}.`,
          )
        "
      >
        {{
          backup.installing.value
            ? 'Adicionando passkey…'
            : 'Adicionar passkey de backup'
        }}
      </button>
      <button type="button" class="acct-link" @click="run(exportPrivateKey)">
        Exportar chave
      </button>
    </div>
  </div>
</template>

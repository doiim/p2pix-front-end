<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { formatUnits } from 'viem';
import { getTokenBalances } from '@doiim/passkeys/smart-account';
import { useUser } from '@/composables/useUser';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { getPublicClient } from '@/blockchain/provider';
import { listTokens } from '@/config/networks';
import type { AccountBalance } from '@/model/AccountBalance';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';
import AccountDeposit from './AccountDeposit.vue';
import AccountSend from './AccountSend.vue';

const user = useUser();
const passkeyAccount = usePasskeyAccount();
const assets = ref<AccountBalance[]>([]);
const balances = computed(() =>
  assets.value.filter((asset) => asset.amount > 0n),
);
const view = ref<'balances' | 'deposit' | 'send'>('balances');
const reloads = ref(0);
const root = ref<HTMLElement>();

// On phones a flow moves the panel above the buy card: bring it into view.
watch(view, () => root.value?.scrollIntoView({ block: 'nearest' }), {
  flush: 'post',
});

watch(
  [user.walletAddress, user.network, reloads],
  async ([address, network], previous, onCleanup) => {
    // Drop the result if the account or network changed while reading.
    let stale = false;
    onCleanup(() => (stale = true));
    if (address !== previous?.[0] || network !== previous?.[1]) {
      assets.value = [];
      view.value = 'balances';
    }
    if (!address) return;
    const tokens = listTokens(network);
    const read = await getTokenBalances(
      getPublicClient(),
      address,
      tokens.map((token) => token.address),
    );
    if (stale) return;
    const native = network.nativeCurrency;
    assets.value = [
      {
        address: null,
        symbol: native.symbol,
        image: getNetworkImage(
          native.symbol === 'ETH' ? 'ethereum' : network.name,
        ),
        amount: read.eth,
        decimals: native.decimals,
      },
      ...read.tokens.map((balance, index) => ({
        address: tokens[index].address,
        symbol: tokens[index].symbol,
        image: getTokenImage(tokens[index].symbol),
        amount: balance.balance,
        decimals: balance.decimals,
      })),
    ];
  },
  { immediate: true },
);

const amountOf = (balance: AccountBalance) =>
  Number(formatUnits(balance.amount, balance.decimals));

// An asset the backend gives no price for shows no R$ value, and then the
// total is hidden too.
const reaisOf = (balance: AccountBalance) => {
  const price = user.prices.value[balance.symbol];
  return price === undefined ? null : amountOf(balance) * price;
};
const total = computed(() => {
  const values = balances.value.map(reaisOf);
  return values.every((value): value is number => value !== null)
    ? values.reduce((sum, value) => sum + value, 0)
    : null;
});

const reais = (value: number | null) =>
  value?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
</script>

<template>
  <div
    v-if="balances.length || view !== 'balances'"
    ref="root"
    class="main-container lg:max-w-90!"
    :class="view === 'balances' ? 'max-lg:mt-4!' : 'max-lg:order-first'"
  >
    <div class="w-full flex flex-col gap-4 bg-white rounded-lg p-5">
      <AccountDeposit
        v-if="view === 'deposit' && user.walletAddress.value"
        :address="user.walletAddress.value"
        :assets="assets"
        @back="view = 'balances'"
      />
      <AccountSend
        v-else-if="view === 'send'"
        :balances="balances"
        @sent="reloads++"
        @close="view = 'balances'"
      />
      <template v-else>
        <div v-if="total !== null" class="flex flex-col">
          <span class="text-sm font-medium text-gray-600">Saldo total</span>
          <span class="text-xl font-semibold text-gray-900">
            ~ {{ reais(total) }}
          </span>
        </div>
        <div v-if="passkeyAccount.isReady.value" class="grid grid-cols-2 gap-2">
          <button
            type="button"
            class="account-button"
            @click="view = 'deposit'"
          >
            Depositar
          </button>
          <button type="button" class="account-button" @click="view = 'send'">
            Enviar
          </button>
        </div>
        <ul class="flex flex-col gap-3 pt-4 border-t border-gray-200">
          <li
            v-for="balance in balances"
            :key="balance.symbol"
            class="flex items-center gap-3 font-semibold text-gray-900"
          >
            <img :src="balance.image" alt="" class="w-6 h-6" />
            <span class="flex-1">{{ balance.symbol }}</span>
            <span class="flex flex-col items-end">
              {{
                amountOf(balance).toLocaleString('pt-BR', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })
              }}
              {{ balance.symbol }}
              <span
                v-if="reaisOf(balance) !== null"
                class="text-xs font-normal text-gray-500"
              >
                ~ {{ reais(reaisOf(balance)) }}
              </span>
            </span>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChevronDown from '@/assets/chevronDown.svg';
import ChevronLeft from '@/assets/chevronLeft.svg';
import CopyIcon from '@/assets/copy.svg';
import QRCode from 'qrcode';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import {
  useAccountRouter,
  useCopyAddress,
} from '@/composables/account/useAccountRouter';
import { useUser } from '@/composables/useUser';
import { findSwapToken } from '@/model/BuyToken';
import { TokenEnum } from '@/model/NetworkEnum';
import { getNetworkImage } from '@/utils/imagesPath';
import NetworkNotice from './NetworkNotice.vue';

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const copyAddress = useCopyAddress();
const user = useUser();
const qrSvg = ref('');

// One address receives every token the network knows and the native coin.
const accepted = account.assets;
const expanded = ref(false);
// Collapsed: the first four tickers and an ellipsis, as in the design.
const summary = computed(() => {
  const symbols = accepted.value.map((token) => token.symbol);
  return symbols.length > 4
    ? `${symbols.slice(0, 4).join(', ')}…`
    : symbols.join(', ');
});
const nameOf = (symbol: string): string => {
  if (symbol === TokenEnum.BRZ) return 'Brazilian Digital Token';
  return (
    findSwapToken(user.network.value, symbol)?.name ??
    user.network.value.nativeCurrency.name
  );
};

const address = computed(() => account.smartAccountAddress.value ?? '');

watch(
  address,
  async (value) => {
    // Level M keeps a 42-char address at 29×29 modules, as drawn; the small
    // logo covers less than the 15% the level tolerates.
    qrSvg.value = value
      ? await QRCode.toString(value, {
          type: 'svg',
          margin: 2,
          errorCorrectionLevel: 'M',
        })
      : '';
  },
  { immediate: true },
);
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      aria-label="Voltar"
      class="p-1 -ml-1 rounded-lg hover:bg-gray-100 cursor-pointer"
      @click="accountRouter.back()"
    >
      <ChevronLeft aria-hidden="true" class="w-5 h-5" />
    </button>
    <h2 class="acct-title">Depositar</h2>
  </div>
  <!-- The address comes from the balance read; without it there is nothing to show. -->
  <p
    v-if="!address"
    class="acct-empty"
    :class="{ 'text-red-500': account.error.value }"
  >
    {{
      account.error.value
        ? 'Não foi possível carregar o endereço.'
        : 'Carregando…'
    }}
  </p>
  <template v-else>
    <div class="relative self-center p-3 border border-gray-200 rounded-lg">
      <div
        class="w-[184px] h-[184px] [&_svg]:h-full [&_svg]:w-full"
        v-html="qrSvg"
      />
      <span
        class="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-[5px]"
      >
        <img
          :src="getNetworkImage(user.network.value.name)"
          alt=""
          class="block w-7 h-7"
        />
      </span>
    </div>
    <div class="flex flex-col items-center gap-1 text-center">
      <span class="acct-label">Endereço da sua conta</span>
      <span
        class="max-w-[21ch] font-mono text-[15px] leading-[22px] text-gray-500 break-all"
      >
        <strong class="font-bold text-gray-900">{{
          address.slice(0, 10)
        }}</strong
        >{{ address.slice(10, -8)
        }}<strong class="font-bold text-gray-900">{{
          address.slice(-8)
        }}</strong>
      </span>
    </div>
    <button type="button" class="account-button" @click="copyAddress">
      <CopyIcon aria-hidden="true" />
      Copiar endereço
    </button>
  </template>
  <div class="flex flex-col gap-2">
    <span id="accepted-label" class="acct-label">
      Tokens aceitos neste endereço
    </span>
    <button
      type="button"
      :aria-expanded="expanded"
      aria-describedby="accepted-label"
      class="flex flex-col gap-2 w-full p-3 border border-gray-300 rounded-lg text-left transition-colors hover:bg-gray-50 cursor-pointer"
      @click="expanded = !expanded"
    >
      <span class="flex -space-x-2">
        <img
          v-for="token in accepted"
          :key="token.symbol"
          :src="token.image"
          alt=""
          class="w-[22px] h-[22px] rounded-full border-2 border-white bg-white"
        />
      </span>
      <span class="flex items-center justify-between gap-2">
        <span class="text-sm font-semibold text-gray-900">{{ summary }}</span>
        <ChevronDown
          aria-hidden="true"
          class="w-4 h-4 transition-transform"
          :class="{ 'scale-y-[-1]': expanded }"
        />
      </span>
    </button>
    <ul
      v-if="expanded"
      class="flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-lg"
    >
      <li
        v-for="token in accepted"
        :key="token.symbol"
        class="flex items-center gap-3 px-3 py-2"
      >
        <img :src="token.image" alt="" class="w-5 h-5 rounded-full" />
        <span class="text-sm font-semibold text-gray-900">{{
          token.symbol
        }}</span>
        <span class="text-xs text-gray-500">{{ nameOf(token.symbol) }}</span>
      </li>
    </ul>
  </div>
  <NetworkNotice />
</template>

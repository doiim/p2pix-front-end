<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import ChevronDown from '@/assets/chevronDown.svg';
import CopyIcon from '@/assets/copyPix.svg';
import QRCode from 'qrcode';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import {
  useAccountRouter,
  useCopyAddress,
} from '@/composables/account/useAccountRouter';
import { useUser } from '@/composables/useUser';
import { getNetworkImage } from '@/utils/imagesPath';
import NetworkNotice from './NetworkNotice.vue';

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const copyAddress = useCopyAddress();
const user = useUser();
const qrSvg = ref('');

// One address receives every token the network knows and the native coin.
const accepted = account.assets;

const address = computed(() => account.smartAccountAddress.value ?? '');

watch(
  address,
  async (value) => {
    // High error correction keeps the code readable under the network logo.
    qrSvg.value = value
      ? await QRCode.toString(value, {
          type: 'svg',
          margin: 0,
          errorCorrectionLevel: 'H',
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
      <ChevronDown aria-hidden="true" class="w-4 h-4 rotate-90" />
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
    <div class="relative self-center p-4 border border-gray-200 rounded-lg">
      <div class="w-30 h-30 [&_svg]:h-full [&_svg]:w-full" v-html="qrSvg" />
      <img
        :src="getNetworkImage(user.network.value.name)"
        alt=""
        class="absolute inset-0 m-auto w-7 h-7 p-0.5 rounded-full bg-white"
      />
    </div>
    <div class="flex flex-col items-center gap-1 text-center">
      <span class="acct-label">Endereço da conta</span>
      <span class="font-mono text-xs text-gray-500 break-all">
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
      <CopyIcon aria-hidden="true" class="scale-75" />
      Copiar endereço
    </button>
  </template>
  <div class="flex flex-col gap-2">
    <span class="acct-label">Tokens aceitos nesta rede</span>
    <div class="flex flex-col gap-1 p-3 border border-gray-200 rounded-lg">
      <span class="flex -space-x-1">
        <img
          v-for="token in accepted"
          :key="token.symbol"
          :src="token.image"
          alt=""
          class="w-4 h-4 rounded-full bg-white"
        />
      </span>
      <span class="text-sm font-semibold text-gray-900">
        {{ accepted.map((token) => token.symbol).join(', ') }}
      </span>
    </div>
  </div>
  <NetworkNotice />
</template>

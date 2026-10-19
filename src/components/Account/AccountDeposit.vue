<script setup lang="ts">
import { ref } from 'vue';
import QRCode from 'qrcode';
import type { Address } from 'viem';
import { useUser } from '@/composables/useUser';
import type { AccountBalance } from '@/model/AccountBalance';
import { getNetworkImage } from '@/utils/imagesPath';

const props = defineProps<{ address: Address; assets: AccountBalance[] }>();
const emit = defineEmits<{ back: [] }>();

const user = useUser();
const qrCode = ref('');
const copied = ref(false);

QRCode.toDataURL(props.address, { margin: 1, width: 240 }).then(
  (url) => (qrCode.value = url),
);

const copyAddress = async () => {
  await navigator.clipboard.writeText(props.address);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1800);
};
</script>

<template>
  <div class="flex items-center gap-2">
    <button
      type="button"
      aria-label="Voltar"
      class="p-1 rounded-lg hover:bg-gray-100"
      @click="emit('back')"
    >
      ←
    </button>
    <h2 class="text-xl font-bold text-gray-900">Depositar</h2>
  </div>
  <div class="relative self-center">
    <img
      v-if="qrCode"
      :src="qrCode"
      alt="QR code do endereço da conta"
      class="w-60 h-60"
    />
    <img
      :src="getNetworkImage(user.network.value.name)"
      alt=""
      class="absolute inset-0 m-auto w-10 h-10 p-1 rounded-full bg-white"
    />
  </div>
  <p class="flex flex-col gap-1 text-gray-900">
    <span class="text-sm font-medium text-gray-600">Endereço da sua conta</span>
    <span class="font-mono text-sm break-all">
      <strong>{{ address.slice(0, 10) }}</strong
      >{{ address.slice(10, -8) }}<strong>{{ address.slice(-8) }}</strong>
    </span>
  </p>
  <button type="button" class="account-button" @click="copyAddress">
    {{ copied ? 'Copiado' : 'Copiar endereço' }}
  </button>
  <div class="flex flex-col gap-2">
    <span class="text-sm font-medium text-gray-600">
      Tokens aceitos neste endereço
    </span>
    <span class="flex items-center gap-2 text-sm font-semibold text-gray-900">
      <img
        v-for="asset in assets"
        :key="asset.symbol"
        :src="asset.image"
        alt=""
        class="w-6 h-6"
      />
      {{ assets.map((asset) => asset.symbol).join(', ') }}
    </span>
  </div>
  <p class="text-xs text-gray-500">
    Envios apenas para a rede {{ user.network.value.name }}
  </p>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import CopyIcon from '@/assets/copyPix.svg';
import QRCode from 'qrcode';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useCopyAddress } from '@/composables/account/useAccountRouter';
import { useUser } from '@/composables/useUser';
import FormCard from '@/components/ui/FormCard.vue';

const { smartAccountAddress } = usePasskeyAccount();
const copyAddress = useCopyAddress();
const user = useUser();
const qrSvg = ref('');

watch(
  smartAccountAddress,
  async (address) => {
    qrSvg.value = address
      ? await QRCode.toString(address, { type: 'svg', width: 192, margin: 2 })
      : '';
  },
  { immediate: true },
);
</script>

<template>
  <FormCard no-border padding="lg">
    <div class="flex flex-col items-center gap-3">
      <div class="h-48 w-48 [&_svg]:h-full [&_svg]:w-full" v-html="qrSvg" />
      <span class="font-bold text-gray-900">Endereço da conta</span>
      <span class="w-4/5 break-all text-center text-xs text-gray-900">
        {{ smartAccountAddress }}
      </span>
      <button
        type="button"
        class="acct-link flex items-center gap-1"
        @click="copyAddress"
      >
        <CopyIcon class="h-4 w-auto [&_path]:stroke-current" />
        Copiar endereço
      </button>
      <p class="text-center text-xs text-gray-400">
        Envie ativos apenas pela rede {{ user.network.value.name }}. Envios por
        outras redes serão perdidos.
      </p>
    </div>
  </FormCard>
</template>

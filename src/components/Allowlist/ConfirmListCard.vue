<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ChainContract, Hex } from 'viem';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import CustomButton from '@/components/ui/CustomButton.vue';
import ChevronDown from '@/assets/chevronDown.svg';
import InfoIcon from '@/assets/info.svg';
import ValidIcon from '@/assets/validIcon.svg';

export type ConfirmRow = { kind: 'in' | 'out' | 'info' | 'ok'; text: string };

defineProps<{
  title: string;
  rows: ConfirmRow[];
  /** Root `setRoot` will write. */
  root: Hex;
  busy: boolean;
  /** Addresses in the list `setRoot` will write. */
  count: number;
}>();
defineEmits<{ back: []; sign: [] }>();

const user = useUser();
const walletAddress = useWalletAddress();
const details = ref(false);
const contract = computed(
  () => (user.network.value.contracts?.p2pix as ChainContract).address,
);
</script>

<template>
  <div class="flex flex-col gap-4 rounded-lg bg-white p-6 text-gray-900">
    <div class="flex items-center gap-4 border-b border-gray-200 pb-4">
      <span class="round-icon" aria-hidden="true">
        <ValidIcon class="[&_path]:fill-white" />
      </span>
      <div>
        <p class="text-sm text-gray-600">Confirme na carteira</p>
        <h2 class="text-xl font-semibold">{{ title }}</h2>
      </div>
    </div>

    <ul class="flex flex-col gap-2">
      <li v-for="row in rows" :key="row.text" class="flex items-start gap-3">
        <span v-if="row.kind === 'in'" class="dot bg-amber-300">+</span>
        <span v-else-if="row.kind === 'out'" class="dot bg-gray-300">−</span>
        <span v-else class="flex h-5 w-5 shrink-0 items-center justify-center">
          <ValidIcon v-if="row.kind === 'ok'" />
          <InfoIcon v-else />
        </span>
        <span>{{ row.text }}</span>
      </li>
    </ul>

    <div class="rounded-lg bg-gray-100">
      <button
        type="button"
        class="flex w-full items-center justify-between px-4 py-3 cursor-pointer"
        :aria-expanded="details"
        @click="details = !details"
      >
        <span class="font-semibold">Detalhes da transação</span>
        <ChevronDown
          class="h-4 w-4 transition-transform"
          :class="{ 'scale-y-[-1]': details }"
        />
      </button>
      <dl v-if="details" class="flex flex-col gap-2 px-4 pb-4 text-sm">
        <div>
          <dt class="text-gray-500">Rede</dt>
          <dd>{{ user.network.value.name }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Endereço</dt>
          <dd class="font-mono break-all">{{ walletAddress }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Lista</dt>
          <dd>{{ count === 1 ? '1 endereço' : `${count} endereços` }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Função</dt>
          <dd class="font-mono">setRoot</dd>
        </div>
        <div>
          <dt class="text-gray-500">Contrato P2Pix</dt>
          <dd class="font-mono break-all">{{ contract }}</dd>
        </div>
        <div>
          <dt class="text-gray-500">Nova raiz</dt>
          <dd class="font-mono break-all">{{ root }}</dd>
        </div>
        <p class="text-gray-600">
          Na carteira, confira se o contrato, a função e a raiz são estes.
        </p>
      </dl>
    </div>

    <p class="text-gray-600">
      Vale para todas as suas ofertas em {{ user.network.value.name }}.
    </p>

    <div class="mt-2 flex items-center justify-end gap-6">
      <button
        type="button"
        class="min-h-11 px-2 font-semibold hover:opacity-70 cursor-pointer disabled:opacity-40"
        :disabled="busy"
        @click="$emit('back')"
      >
        Voltar
      </button>
      <CustomButton
        text="Assinar na carteira"
        size="lg"
        :full-width="false"
        :loading="busy"
        @button-clicked="$emit('sign')"
      />
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.round-icon {
  @apply flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-900;
}

.dot {
  @apply flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-sm font-bold leading-none;
}
</style>

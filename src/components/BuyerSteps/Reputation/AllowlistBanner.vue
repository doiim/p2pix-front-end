<script setup lang="ts">
import { ref } from 'vue';
import { shortAddress } from '@/utils/shortAddress';
import { formatTokens } from '@/utils/reputation';
import ChevronDown from '@/assets/chevronDown.svg';
import ValidIcon from '@/assets/validIcon.svg';

defineProps<{
  seller: string;
  networkName: string;
  limitTokens: bigint | null;
}>();
defineEmits<{ ignore: [] }>();

const details = ref(false);
</script>

<template>
  <div class="flex flex-col gap-2 pt-3">
    <div class="flex items-start gap-3">
      <ValidIcon class="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div class="min-w-0 flex-1">
        <p class="m-0 break-words text-sm font-semibold text-gray-900">
          Limite liberado por {{ shortAddress(seller, 6, '…') }}
        </p>
        <p class="m-0 text-sm text-gray-500">
          Nas ofertas dele em {{ networkName }},
          {{
            limitTokens === null
              ? 'o limite de reputação não vale.'
              : `seu limite de R$ ${formatTokens(limitTokens)} não vale.`
          }}
        </p>
      </div>
      <button
        type="button"
        class="flex min-h-11 shrink-0 items-center gap-1 text-sm font-medium text-gray-900 cursor-pointer"
        :aria-expanded="details"
        @click="details = !details"
      >
        Detalhes
        <ChevronDown
          class="h-3 w-3 transition-transform"
          :class="{ 'scale-y-[-1]': details }"
        />
      </button>
    </div>
    <dl
      v-if="details"
      class="m-0 flex flex-col gap-2 rounded-lg bg-gray-100 p-3 text-sm sm:p-4"
    >
      <div>
        <dt class="text-gray-500">Vendedor</dt>
        <dd class="m-0 font-mono break-all text-gray-900">{{ seller }}</dd>
      </div>
      <div>
        <dt class="text-gray-500">Rede</dt>
        <dd class="m-0 text-gray-900">{{ networkName }}</dd>
      </div>
      <div>
        <dt class="text-gray-500">Prova</dt>
        <dd class="m-0 flex items-center gap-1 text-gray-900">
          <ValidIcon class="h-4 w-4" aria-hidden="true" /> Conferida
        </dd>
      </div>
    </dl>
    <button
      type="button"
      class="min-h-11 self-start text-sm text-gray-900 underline cursor-pointer"
      @click="$emit('ignore')"
    >
      Comprar sem o link
    </button>
  </div>
</template>

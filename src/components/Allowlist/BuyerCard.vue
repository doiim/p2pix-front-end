<script setup lang="ts">
import type { AllowlistEntry } from '@/utils/allowlistStorage';
import { shortHex } from '@/utils/allowlist';
import TrashIcon from '@/assets/trash.svg';

export type BuyerStatus = 'onchain' | 'offchain' | 'new' | 'leaving';

defineProps<{ entry: AllowlistEntry; status: BuyerStatus }>();
defineEmits<{ remove: []; undo: [] }>();
</script>

<template>
  <div
    class="card"
    :class="{
      'border-amber-400!': status === 'new',
      'bg-gray-100!': status === 'leaving',
    }"
  >
    <div class="flex items-center gap-3 border-b border-gray-200 pb-3">
      <span
        class="avatar"
        :class="{ 'bg-gray-400!': status === 'leaving' }"
        aria-hidden="true"
      >
        <span v-if="entry.nickname" class="font-semibold">
          {{ entry.nickname[0].toUpperCase() }}
        </span>
      </span>
      <div
        class="min-w-0"
        :class="{ 'text-gray-400 line-through': status === 'leaving' }"
      >
        <p
          class="truncate"
          :class="
            entry.nickname ? 'font-semibold text-gray-900' : 'text-gray-500'
          "
        >
          {{ entry.nickname ?? 'Sem apelido' }}
        </p>
        <p class="font-mono text-sm text-gray-600" :title="entry.address">
          {{ shortHex(entry.address) }}
        </p>
      </div>
    </div>

    <div class="flex min-h-9 items-center justify-between gap-2 pt-3">
      <span v-if="status === 'leaving'" class="tag bg-gray-300 text-gray-700">
        Sai da lista
      </span>
      <span v-else-if="status === 'new'" class="flex items-center gap-2">
        <span class="tag bg-amber-300 text-gray-900">Novo</span>
        <span class="text-xs text-gray-500">entra ao gravar a lista</span>
      </span>
      <span v-else class="flex items-center gap-2 text-sm text-gray-700">
        <span
          class="h-2 w-2 rounded-full"
          :class="status === 'onchain' ? 'bg-emerald-500' : 'bg-gray-400'"
        />
        {{ status === 'onchain' ? 'Na rede' : 'Só neste navegador' }}
      </span>

      <button
        v-if="status === 'leaving'"
        type="button"
        class="min-h-11 px-2 font-semibold text-gray-900 hover:opacity-70 cursor-pointer"
        :aria-label="`Manter ${entry.nickname ?? shortHex(entry.address)} na lista`"
        @click="$emit('undo')"
      >
        Desfazer
      </button>
      <button
        v-else
        type="button"
        class="icon-button"
        :aria-label="`Remover ${entry.nickname ?? shortHex(entry.address)} da lista`"
        @click="$emit('remove')"
      >
        <TrashIcon />
      </button>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.card {
  @apply flex flex-col rounded-lg border-2 border-transparent bg-white p-4;
}

.avatar {
  @apply flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-900 text-white;
}

.tag {
  @apply rounded-md px-2 py-1 text-sm font-medium;
}

.icon-button {
  @apply flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-900 hover:bg-gray-100 cursor-pointer;
}
</style>

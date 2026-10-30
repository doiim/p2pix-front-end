<script setup lang="ts">
import { computed, ref } from 'vue';
import type { TrustedBuyers } from '@/composables/useTrustedBuyers';
import { entryLabel, type AllowlistEntry } from '@/utils/allowlistStorage';
import { shortHex } from '@/utils/allowlist';
import CustomButton from '@/components/ui/CustomButton.vue';
import PlusIcon from '@/assets/plus.svg';

const props = defineProps<{ list: TrustedBuyers }>();
defineEmits<{ review: [] }>();

const address = ref('');
const nickname = ref('');
const error = ref<string>();

const submit = () => {
  error.value = props.list.add(address.value, nickname.value);
  if (error.value) return;
  address.value = '';
  nickname.value = '';
};

const names = new Intl.ListFormat('pt-BR', {
  style: 'long',
  type: 'conjunction',
});

const phrase = (entries: AllowlistEntry[], one: string, many: string) =>
  entries.length
    ? [
        `${names.format(entries.map(entryLabel))} ${entries.length === 1 ? one : many}`,
      ]
    : [];

const title = computed(() => {
  const count = props.list.changeCount.value;
  if (!count) {
    const n = props.list.draft.value.length;
    if (!n) return 'Lista vazia';
    return `Reativar a lista com ${n} ${n === 1 ? 'endereço' : 'endereços'}`;
  }
  return count === 1 ? '1 alteração a gravar' : `${count} alterações a gravar`;
});

/** The bar's sentence, split so the root can be shown in monospace. */
const summary = computed(() => {
  const list = props.list;
  const changes = [
    ...phrase(list.added.value, 'entra', 'entram'),
    ...phrase(list.leaving.value, 'sai', 'saem'),
  ].join(', ');
  const hasList = list.draft.value.length > 0;
  const tail = hasList
    ? list.isActive.value
      ? ' · os arquivos já enviados deixam de valer'
      : ' · depois, baixe a lista (.json) e envie aos compradores'
    : ' · gravar desativa a lista';
  return {
    lead: changes ? `${changes} · ` : '',
    label: hasList ? 'nova raiz ' : 'raiz ',
    root: hasList ? shortHex(list.draftRoot.value) : 'zero',
    tail,
  };
});
</script>

<template>
  <div class="overflow-hidden rounded-lg bg-white">
    <form class="flex flex-col gap-2 p-6" @submit.prevent="submit">
      <div class="flex items-center gap-4 border-b border-gray-200 pb-4">
        <span class="round-icon" aria-hidden="true">
          <PlusIcon class="[&_path]:fill-white" />
        </span>
        <h2 class="text-xl font-semibold text-gray-900">Adicionar comprador</h2>
      </div>

      <label for="buyer-address" class="acct-label mt-2"
        >Endereço da carteira</label
      >
      <input
        id="buyer-address"
        v-model="address"
        class="field font-mono"
        :class="{ 'ring-2 ring-red-700': error }"
        placeholder="0x…"
        autocomplete="off"
        spellcheck="false"
        :aria-invalid="!!error"
        aria-describedby="buyer-address-error"
        @input="error = undefined"
      />

      <label for="buyer-nickname" class="acct-label mt-2"
        >Apelido (opcional)</label
      >
      <div class="flex flex-col gap-3 sm:flex-row">
        <input
          id="buyer-nickname"
          v-model="nickname"
          class="field min-w-0 flex-1"
          placeholder="Ex.: Marina"
          maxlength="40"
        />
        <button type="submit" class="account-button px-5!">
          <span aria-hidden="true" class="text-xl leading-none">+</span>
          <span class="font-semibold">Adicionar</span>
        </button>
      </div>

      <p
        v-if="error"
        id="buyer-address-error"
        class="text-sm text-red-700"
        role="alert"
      >
        {{ error }}
      </p>
      <p class="text-sm text-gray-500">
        Use o endereço que aparece no topo do app do comprador. O apelido não
        vai para a rede.
      </p>
    </form>

    <div
      v-if="list.hasPending.value"
      class="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 p-6"
    >
      <div>
        <p class="text-lg font-semibold text-gray-900">{{ title }}</p>
        <p class="text-gray-600 break-words">
          {{ summary.lead }}{{ summary.label
          }}<span class="font-mono">{{ summary.root }}</span
          >{{ summary.tail }}
        </p>
      </div>
      <CustomButton
        text="Gravar lista na rede"
        size="lg"
        :is-disabled="list.busy.value"
        @button-clicked="$emit('review')"
      />
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.round-icon {
  @apply flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-900;
}

.field {
  @apply w-full rounded-lg bg-gray-100 px-4 py-3 text-gray-900 outline-none placeholder:text-gray-400 focus:ring-2 focus:ring-amber-400;
}
</style>

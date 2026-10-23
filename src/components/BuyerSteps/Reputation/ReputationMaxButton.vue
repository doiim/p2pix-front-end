<script setup lang="ts">
import { computed, useTemplateRef } from 'vue';
import { formatBrl, formatTokens, maxFill } from '@/utils/reputation';
import type { LimitRowVariant } from '@/utils/reputation';

const props = defineProps<{
  variant: LimitRowVariant;
  limitTokens: bigint;
  maxOfferCents: bigint | null;
}>();

const emit = defineEmits<{ fill: [cents: bigint] }>();

const buttonEl = useTemplateRef<HTMLButtonElement>('button');

const target = computed(() => maxFill(props.limitTokens, props.maxOfferCents));

const label = computed(() => {
  if (target.value.binding === 'offer') {
    return `Máx: usar a maior oferta de R$ ${formatBrl(target.value.cents)}`;
  }
  const limit = formatTokens(props.limitTokens);
  return {
    over: `Máx: usar seu limite de R$ ${limit}`,
    cap: `Máx: usar o limite máximo de R$ ${limit}`,
    refused: `Máx: usar seu limite atual de R$ ${limit}`,
  }[props.variant];
});

defineExpose({ focus: () => buttonEl.value?.focus() });
</script>

<template>
  <!-- Below sm the button is a 44px tap target; the inner span carries the visual chip. -->
  <button
    ref="button"
    type="button"
    :aria-label="label"
    class="group/max flex-none flex items-center min-h-11 px-1 sm:min-h-0 sm:px-0 rounded border-0 bg-transparent cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
    @click="emit('fill', target.cents)"
  >
    <span
      class="block px-1 py-0.5 rounded text-xs font-medium text-gray-500 group-hover/max:bg-gray-100 group-hover/max:text-gray-900"
      >Máx</span
    >
  </button>
</template>

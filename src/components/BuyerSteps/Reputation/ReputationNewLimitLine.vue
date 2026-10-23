<script setup lang="ts">
import { formatTokens } from '@/utils/reputation';

defineProps<{
  networkName: string;
  beforeTokens: bigint;
  afterTokens: bigint;
}>();
</script>

<template>
  <!-- A <div>, not a <p>: BuyConfirmedComponent's scoped `p { text-gray-900 }` would override the colour. -->
  <div class="mt-1 text-sm text-gray-600">
    Seu novo limite por compra em {{ networkName }}:
    <strong class="font-semibold text-gray-900 whitespace-nowrap"
      >R$ {{ formatTokens(afterTokens) }}</strong
    >
    (antes
    <span class="whitespace-nowrap">R$ {{ formatTokens(beforeTokens) }}</span
    >).
  </div>
</template>

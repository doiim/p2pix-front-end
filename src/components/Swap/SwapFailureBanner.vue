<script setup lang="ts">
import { swapFailureText, type SwapFailure } from '@/utils/swapFailure';

defineProps<{ reason: SwapFailure; token: string }>();
</script>

<template>
  <!-- Same look as CustomAlert: the quote has no route, the user picks what to do. -->
  <p
    role="status"
    class="w-full px-4 py-3 rounded-lg bg-amber-400 text-gray-900 text-sm sm:text-base font-semibold leading-snug"
  >
    {{ swapFailureText(reason, token) }}
  </p>
</template>

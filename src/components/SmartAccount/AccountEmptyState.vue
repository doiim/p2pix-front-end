// Card tabs' empty state: message per tab, the receive action lives here.
<script setup lang="ts">
import { useAccountRouter } from '@/composables/account/useAccountRouter';

// A prop rather than a slot: a newline after <slot /> drops the space before
// the button.
defineProps<{ message: string }>();

const accountRouter = useAccountRouter();
</script>

<template>
  <p class="acct-empty">
    {{ message }}
    <button
      type="button"
      class="acct-link text-sm"
      @click="accountRouter.push('receive')"
    >
      Receber fundos
    </button>
  </p>
</template>

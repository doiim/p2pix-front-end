<script setup lang="ts">
import { ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import ChevronDown from '@/assets/chevronDown.svg';

defineProps<{ label: string }>();

const open = ref(false);
const rootRef = ref<HTMLElement | null>(null);
onClickOutside(rootRef, () => (open.value = false));

const close = () => (open.value = false);
</script>

<template>
  <div ref="rootRef" class="relative">
    <button
      type="button"
      class="chip"
      :aria-expanded="open"
      :aria-label="label"
      @click="open = !open"
    >
      <slot />
      <ChevronDown
        class="h-4 w-4 text-gray-900 transition-transform"
        :class="{ 'scale-y-[-1]': open }"
      />
    </button>
    <transition name="dropdown">
      <div v-if="open" class="menu">
        <slot name="items" :close="close" />
      </div>
    </transition>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.chip {
  @apply flex min-w-fit items-center gap-2 rounded-3xl bg-gray-300 px-3 py-2 transition-colors hover:bg-gray-200 cursor-pointer;
}

.menu {
  @apply absolute right-0 z-50 mt-2 min-w-max overflow-clip rounded-xl border border-gray-300 bg-white shadow-md;
}

.menu :deep(.menu-item) {
  @apply flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-300 cursor-pointer;
}
</style>

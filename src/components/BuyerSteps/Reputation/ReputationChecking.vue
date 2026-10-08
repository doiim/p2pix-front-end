<script setup lang="ts">
const SKELETON_WIDTHS = ['w-[70%]', 'w-2/5', 'w-full', 'w-[85%]', 'w-3/5'];
</script>

<template>
  <div>
    <!-- Same height as the limit row it replaces, so nothing jumps when the read resolves. -->
    <div
      role="status"
      class="flex items-center gap-2 min-h-12 pt-1 sm:min-h-9 sm:pt-2"
    >
      <span class="text-sm text-gray-600">Verificando seu limite…</span>
      <span
        aria-hidden="true"
        class="block size-4 box-border border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin motion-reduce:animate-none"
      ></span>
    </div>
    <div
      aria-hidden="true"
      class="w-0 h-0 mt-2 border-x-8 border-x-transparent border-b-8 border-b-gray-100"
    ></div>
    <div
      aria-hidden="true"
      class="flex flex-col gap-2.5 p-3 sm:p-4 rounded-lg bg-gray-100"
    >
      <div
        v-for="width in SKELETON_WIDTHS"
        :key="width"
        class="h-4 rounded bg-gray-200 animate-pulse motion-reduce:animate-none"
        :class="width"
      ></div>
    </div>
  </div>
</template>

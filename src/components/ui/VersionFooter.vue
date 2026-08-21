<script setup lang="ts">
const version = import.meta.env.APP_VERSION as string;
</script>

<template>
  <div
    class="fixed bottom-2 left-2 text-xs font-mono text-gray-50/40 hover:text-gray-50/80 transition-opacity pointer-events-none select-none z-10"
    :title="`P2Pix ${version}`"
    aria-label="Application version"
  >
    v{{ version }}
  </div>
</template>

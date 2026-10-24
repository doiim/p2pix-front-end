<script setup lang="ts">
import { useRoute } from 'vue-router';

const TABS = [
  { route: 'home', label: 'Comprar', selling: false },
  { route: 'seller', label: 'Vender', selling: true },
] as const;

const route = useRoute();
</script>

<template>
  <nav aria-label="Tipo de oferta" class="grid grid-cols-2 gap-2 w-full">
    <RouterLink
      v-for="tab in TABS"
      :key="tab.route"
      :to="{ name: tab.route }"
      class="tab"
      :class="{ 'is-active': tab.selling === (route.name === 'seller') }"
    >
      {{ tab.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
@reference "tailwindcss";

.tab {
  @apply flex items-center justify-center min-h-11 rounded-lg border border-gray-500 font-semibold text-white transition-colors;
}

.tab:hover {
  @apply bg-white/10;
}

.tab.is-active {
  @apply bg-white border-white text-gray-900;
}
</style>

<script setup lang="ts">
import SpinnerComponent from "./SpinnerComponent.vue";

const props = withDefaults(
  defineProps<{
    message?: string;
    size?: "sm" | "md" | "lg";
    centered?: boolean;
    inline?: boolean;
  }>(),
  {
    message: "Carregando...",
    size: "md",
    centered: true,
    inline: false,
  }
);

const sizeMap = {
  sm: { spinner: "4", text: "text-sm" },
  md: { spinner: "6", text: "text-base" },
  lg: { spinner: "8", text: "text-lg" },
};
</script>

<template>
  <div
    :class="[
      'loading-state',
      { centered: centered, inline: inline },
    ]"
  >
    <span v-if="message" :class="['loading-message', sizeMap[size].text]">
      {{ message }}
    </span>
    <SpinnerComponent
      :width="sizeMap[size].spinner"
      :height="sizeMap[size].spinner"
    />
  </div>
</template>

<style scoped>
.loading-state {
  @apply flex items-center gap-2;
}

.loading-state.centered {
  @apply justify-center;
}

.loading-state.inline {
  @apply inline-flex;
}

.loading-message {
  @apply text-gray-900 font-normal;
}
</style>


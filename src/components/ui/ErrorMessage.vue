<script setup lang="ts">
export type ErrorType = "error" | "warning" | "info";

const props = withDefaults(
  defineProps<{
    message: string;
    type?: ErrorType;
    centered?: boolean;
    icon?: boolean;
  }>(),
  {
    type: "error",
    centered: true,
    icon: false,
  }
);

const colorClasses = {
  error: "text-red-500",
  warning: "text-amber-500",
  info: "text-blue-500",
};
</script>

<template>
  <div :class="['error-message-container', { centered: centered }]">
    <div :class="['error-message', colorClasses[type]]">
      <span v-if="icon" class="icon">⚠</span>
      <span class="message">{{ message }}</span>
    </div>
  </div>
</template>

<style scoped>
.error-message-container {
  @apply flex w-full;
}

.error-message-container.centered {
  @apply justify-center;
}

.error-message {
  @apply font-normal text-sm flex items-center gap-2;
}

.icon {
  @apply text-base;
}

.message {
  @apply leading-tight;
}
</style>


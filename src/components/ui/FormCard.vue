<script setup lang="ts">
export type FormCardPadding = "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    padding?: FormCardPadding;
    fullWidth?: boolean;
    noBorder?: boolean;
  }>(),
  {
    padding: "md",
    fullWidth: true,
    noBorder: false,
  }
);
</script>

<template>
  <div
    :class="[
      'form-card',
      `padding-${padding}`,
      { 'full-width': fullWidth, 'no-border': noBorder },
    ]"
  >
    <slot></slot>
  </div>
</template>

<style scoped>
.form-card {
  @apply flex flex-col bg-white rounded-lg;
}

.form-card:not(.no-border) {
  @apply border-y-10;
}

.form-card.full-width {
  @apply w-full;
}

.padding-sm {
  @apply px-4 py-3;
}

.padding-md {
  @apply sm:px-10 px-6 py-5;
}

.padding-lg {
  @apply px-12 py-8;
}
</style>


<script setup lang="ts">
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

const props = withDefaults(
  defineProps<{
    text: string;
    isDisabled?: boolean;
    variant?: ButtonVariant;
    size?: ButtonSize;
    icon?: string;
    iconPosition?: "left" | "right";
    fullWidth?: boolean;
    loading?: boolean;
  }>(),
  {
    isDisabled: false,
    variant: "primary",
    size: "xl",
    iconPosition: "left",
    fullWidth: true,
    loading: false,
  }
);

const emit = defineEmits(["buttonClicked"]);

const handleClick = () => {
  if (!props.isDisabled && !props.loading) {
    emit("buttonClicked");
  }
};
</script>

<template>
  <button
    type="button"
    :class="[
      'button',
      `variant-${variant}`,
      `size-${size}`,
      { 'is-disabled': isDisabled || loading, 'full-width': fullWidth },
    ]"
    :disabled="isDisabled || loading"
    @click="handleClick"
  >
    <span v-if="loading" class="loader"></span>
    <template v-else>
      <img
        v-if="icon && iconPosition === 'left'"
        :src="icon"
        :alt="`${text} icon`"
        class="button-icon"
      />
      <span class="button-text">{{ text }}</span>
      <img
        v-if="icon && iconPosition === 'right'"
        :src="icon"
        :alt="`${text} icon`"
        class="button-icon"
      />
    </template>
  </button>
</template>

<style scoped>
.button {
  @apply rounded-lg font-semibold transition-all duration-200 cursor-pointer flex items-center justify-center gap-2;
}

.button:hover:not(.is-disabled) {
  @apply transform scale-[1.02];
}

.button.is-disabled {
  @apply opacity-70 cursor-not-allowed;
}

.button.full-width {
  @apply w-full;
}

/* Variantes */
.variant-primary {
  @apply bg-amber-400 text-gray-900 border-2 border-amber-400;
}

.variant-primary:hover:not(.is-disabled) {
  @apply bg-amber-500 border-amber-500;
}

.variant-secondary {
  @apply bg-gray-200 text-gray-900 border-2 border-gray-300;
}

.variant-secondary:hover:not(.is-disabled) {
  @apply bg-gray-300 border-gray-400;
}

.variant-outline {
  @apply bg-transparent text-gray-900 border-2 border-amber-400;
}

.variant-outline:hover:not(.is-disabled) {
  @apply bg-amber-400/10;
}

.variant-ghost {
  @apply bg-transparent text-gray-900 border-2 border-transparent;
}

.variant-ghost:hover:not(.is-disabled) {
  @apply bg-gray-100;
}

/* Tamanhos */
.size-sm {
  @apply px-2 py-1 text-xs;
}

.size-sm .button-icon {
  @apply w-3 h-3;
}

.size-md {
  @apply px-3 py-2 text-sm;
}

.size-md .button-icon {
  @apply w-4 h-4;
}

.size-lg {
  @apply px-4 py-3 text-base;
}

.size-lg .button-icon {
  @apply w-5 h-5;
}

.size-xl {
  @apply p-4 text-base;
}

.size-xl .button-icon {
  @apply w-5 h-5;
}

.button-icon {
  @apply flex-shrink-0;
}

.button-text {
  @apply font-semibold;
}

/* Loader animation */
.loader {
  @apply w-5 h-5 border-2 border-gray-900 border-t-transparent rounded-full animate-spin;
}
</style>

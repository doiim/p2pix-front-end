<script setup lang="ts">
export type IconButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type IconButtonSize = "sm" | "md" | "lg";
export type IconPosition = "left" | "right";

const props = withDefaults(
  defineProps<{
    text: string;
    icon?: string;
    variant?: IconButtonVariant;
    size?: IconButtonSize;
    iconPosition?: IconPosition;
    disabled?: boolean;
    fullWidth?: boolean;
  }>(),
  {
    variant: "outline",
    size: "md",
    iconPosition: "left",
    disabled: false,
    fullWidth: false,
  }
);

const emit = defineEmits<{
  click: [];
}>();

const handleClick = () => {
  if (!props.disabled) {
    emit("click");
  }
};
</script>

<template>
  <button
    type="button"
    :class="[
      'icon-button',
      `variant-${variant}`,
      `size-${size}`,
      { 'is-disabled': disabled, 'full-width': fullWidth },
    ]"
    :disabled="disabled"
    @click="handleClick"
  >
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
  </button>
</template>

<style scoped>
.icon-button {
  @apply flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 cursor-pointer;
}

.icon-button:hover:not(.is-disabled) {
  @apply transform scale-[1.02];
}

.icon-button.is-disabled {
  @apply opacity-60 cursor-not-allowed;
}

.icon-button.full-width {
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
  @apply bg-transparent text-gray-900 border-2 border-amber-300;
}

.variant-outline:hover:not(.is-disabled) {
  @apply bg-amber-300/10;
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

.button-text {
  @apply font-semibold;
}

.button-icon {
  @apply flex-shrink-0;
}
</style>


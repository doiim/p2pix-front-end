<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useFloating, arrow, offset, flip, shift } from "@floating-ui/vue";

const props = withDefaults(
  defineProps<{
    text: string;
    placement?: "top" | "bottom" | "left" | "right";
    iconSrc?: string;
    showOnHover?: boolean;
  }>(),
  {
    placement: "right",
    iconSrc: "",
    showOnHover: true,
  }
);

const showTooltip = ref<boolean>(false);
const reference = ref<HTMLElement | null>(null);
const floating = ref<HTMLElement | null>(null);
const floatingArrow = ref(null);

onMounted(() => {
  useFloating(reference, floating, {
    placement: props.placement,
    middleware: [offset(10), flip(), shift(), arrow({ element: floatingArrow })],
  });
});

const handleMouseOver = () => {
  if (props.showOnHover) {
    showTooltip.value = true;
  }
};

const handleMouseOut = () => {
  if (props.showOnHover) {
    showTooltip.value = false;
  }
};

const toggleTooltip = () => {
  if (!props.showOnHover) {
    showTooltip.value = !showTooltip.value;
  }
};
</script>

<template>
  <div class="info-tooltip-container">
    <img
      :src="iconSrc || '/src/assets/info.svg'"
      alt="info icon"
      class="info-icon"
      ref="reference"
      @mouseover="handleMouseOver"
      @mouseout="handleMouseOut"
      @click="toggleTooltip"
    />
    <div
      v-if="showTooltip"
      role="tooltip"
      ref="floating"
      class="tooltip-content"
    >
      {{ text }}
    </div>
  </div>
</template>

<style scoped>
.info-tooltip-container {
  @apply relative inline-block;
}

.info-icon {
  @apply cursor-pointer transition-opacity hover:opacity-70;
}

.tooltip-content {
  @apply bg-white text-gray-900 font-medium text-xs md:text-sm px-3 py-2 rounded border-2 border-emerald-500 z-50 max-w-xs shadow-lg;
}

@media screen and (max-width: 640px) {
  .tooltip-content {
    display: none;
  }
}
</style>


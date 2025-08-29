<script setup lang="ts">
import SpinnerComponent from "@/components/ui/SpinnerComponent.vue";

const props = defineProps({
  text: String,
  isDisabled: Boolean,
  isLoading: Boolean,
  type: {
    type: String as () => "button" | "submit" | "reset",
    default: "button",
  },
});

const emit = defineEmits(["buttonClicked"]);
</script>

<template>
  <button
    :type="props.type"
    class="button"
    @click="emit('buttonClicked')"
    v-bind:class="{ 'opacity-70': props.isDisabled || props.isLoading }"
    :disabled="props.isDisabled || props.isLoading"
  >
    <div v-if="props.isLoading" class="flex items-center justify-center gap-2">
      <SpinnerComponent width="4" height="4" color="fill-gray-900" />
      <span>{{ props.text }}</span>
    </div>
    <span v-else>{{ props.text }}</span>
  </button>
</template>

<style scoped>
.button {
  @apply rounded-lg w-full text-base font-semibold text-gray-900 p-4 bg-amber-400;
}
</style>

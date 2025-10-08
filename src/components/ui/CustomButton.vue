<script setup lang="ts">
const props = defineProps({
  text: String,
  isDisabled: Boolean,
});

const emit = defineEmits(["buttonClicked"]);
</script>

<template>
  <button
    type="button"
    class="button"
    @click="emit('buttonClicked')"
    v-bind:class="{ 'opacity-70': props.isDisabled }"
    :disabled="props.isDisabled ? props.isDisabled : false"
  >
    {{ props.text }}
  </button>
</template>

<style scoped>
.button {
  @apply rounded-lg w-full text-base font-semibold text-gray-900 p-4 bg-amber-400;
}
</style>

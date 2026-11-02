<script setup lang="ts">
import { ref } from 'vue';
import { pickAllowlistFile } from '@/utils/allowlistStorage';
import UploadIcon from '@/assets/upload.svg';

const emit = defineEmits<{ file: [file: File] }>();
const dragging = ref(false);

const choose = async () => {
  const file = await pickAllowlistFile();
  if (file) emit('file', file);
};

const drop = (event: DragEvent) => {
  dragging.value = false;
  const file = event.dataTransfer?.files[0];
  if (file) emit('file', file);
};
</script>

<template>
  <button
    type="button"
    class="zone"
    :class="{ 'border-amber-400! bg-amber-50!': dragging }"
    @click="choose"
    @dragover.prevent="dragging = true"
    @dragleave="dragging = false"
    @drop.prevent="drop"
  >
    <UploadIcon class="text-gray-900" />
    <span class="text-lg font-semibold text-gray-900">
      Arraste o arquivo da lista para cá
    </span>
    <span class="text-gray-600">
      ou clique para escolher no computador · arquivo .json
    </span>
  </button>
</template>

<style scoped>
@reference "tailwindcss";

.zone {
  @apply flex w-full flex-col items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center transition-colors hover:bg-gray-100 cursor-pointer;
}
</style>

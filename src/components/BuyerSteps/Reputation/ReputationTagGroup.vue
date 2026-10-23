<script setup lang="ts">
import { nextTick } from 'vue';
import type { PanelTag } from '@/utils/reputation';

const props = defineProps<{
  tag: PanelTag | null;
  tags: readonly PanelTag[];
}>();

const emit = defineEmits<{ 'update:tag': [tag: PanelTag | null] }>();

const LABELS: Record<PanelTag, string> = {
  chart: 'Gráfico',
  howItWorks: 'Como funciona',
  verification: 'Verificação',
};

// The tag body above the group changes height, so keep the pressed tag in view.
const pick = (selected: PanelTag, event: MouseEvent) => {
  emit('update:tag', props.tag === selected ? null : selected);
  const button = event.currentTarget;
  if (button instanceof HTMLElement) {
    void nextTick(() => button.scrollIntoView({ block: 'nearest' }));
  }
};
</script>

<template>
  <!-- Below sm each tag is a 44px tap target over a 32px track; from sm the group is a 28px segmented control. -->
  <div
    role="group"
    aria-label="Mais sobre o limite"
    class="relative flex mt-1.5 px-0.5 sm:items-center sm:gap-0.5 sm:mt-3 sm:p-0.5 sm:rounded-lg sm:bg-gray-200"
  >
    <span
      aria-hidden="true"
      class="absolute inset-x-0 top-1.5 bottom-1.5 rounded-lg bg-gray-200 sm:hidden"
    ></span>
    <template v-for="(item, index) in tags" :key="item">
      <span
        v-if="index > 0"
        aria-hidden="true"
        class="relative flex-none self-center w-px h-2.5 sm:h-3"
        :class="
          tag === item || tag === tags[index - 1]
            ? 'bg-transparent'
            : 'bg-gray-300'
        "
      ></span>
      <button
        type="button"
        :aria-pressed="tag === item ? 'true' : 'false'"
        aria-controls="rep-details"
        class="group/tag relative flex-auto flex items-center min-w-0 min-h-11 p-0 sm:min-h-0 border-0 rounded-md bg-transparent cursor-pointer max-sm:scroll-mb-22 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
        @click="pick(item, $event)"
      >
        <span
          v-if="tag === item"
          class="flex-auto flex items-center min-w-0 rounded-md bg-white text-[11px] leading-[14px] max-[359px]:text-[10px] sm:text-xs sm:leading-4 font-semibold text-gray-900 whitespace-nowrap shadow-[0_1px_2px_rgba(16,24,40,0.12)]"
        >
          <span
            class="flex-auto min-w-0 truncate py-[7px] pl-1 pr-[3px] max-[359px]:px-0.5 sm:py-1 sm:pl-2 sm:pr-1.5 text-center text-gray-900"
            >{{ LABELS[item] }}</span
          >
          <span
            aria-hidden="true"
            class="block flex-none w-px h-2.5 sm:h-3 bg-gray-300"
          ></span>
          <span
            aria-hidden="true"
            class="flex-none flex items-center justify-center w-[18px] h-7 sm:size-6"
          >
            <svg
              viewBox="0 0 10 10"
              fill="none"
              class="block size-[7px] sm:size-2 text-gray-500"
            >
              <path
                d="M2 2l6 6M8 2l-6 6"
                stroke="currentColor"
                stroke-width="1.75"
                stroke-linecap="round"
              />
            </svg>
          </span>
        </span>
        <span
          v-else
          class="flex-auto block min-w-0 truncate px-1 max-[359px]:px-0.5 py-[7px] sm:px-2 sm:py-1 rounded-md text-center text-[11px] leading-[14px] max-[359px]:text-[10px] sm:text-xs sm:leading-4 font-medium text-gray-600 group-hover/tag:bg-gray-100 group-hover/tag:text-gray-900"
          >{{ LABELS[item] }}</span
        >
      </button>
    </template>
  </div>
</template>

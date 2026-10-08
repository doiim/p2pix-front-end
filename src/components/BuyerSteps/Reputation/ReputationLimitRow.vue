<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  useTemplateRef,
  watch,
} from 'vue';
import ChevronDown from '@/assets/chevronDown.svg';
import infoIconUrl from '@/assets/info.svg?url';
import { LIMIT_ROW_SENTENCES, formatTokens } from '@/utils/reputation';
import type { LimitRowVariant } from '@/utils/reputation';

defineProps<{
  variant: LimitRowVariant;
  limitTokens: bigint;
  expanded: boolean;
}>();

const emit = defineEmits<{ toggle: [] }>();

const toggleEl = useTemplateRef<HTMLButtonElement>('toggle');
const wrapperEl = useTemplateRef<HTMLSpanElement>('wrapper');
const pillEl = useTemplateRef<HTMLButtonElement>('pill');
const tipEl = useTemplateRef<HTMLSpanElement>('tip');

// 'auto' leaves the tooltip to CSS hover/focus-within; a tap pins it (iOS does not focus buttons on tap);
// Escape or a tap elsewhere dismisses it until the pill is hovered or focused again (WCAG 1.4.13).
const tipMode = ref<'auto' | 'pinned' | 'dismissed'>('auto');
const hovered = ref(false);
const focused = ref(false);
const arrowX = ref<number | null>(null);

const TIP_CLASSES = {
  auto: 'invisible opacity-0 -translate-y-1 group-hover/tip:visible group-hover/tip:opacity-100 group-hover/tip:translate-y-0 group-focus-within/tip:visible group-focus-within/tip:opacity-100 group-focus-within/tip:translate-y-0',
  pinned: 'visible opacity-100 translate-y-0',
  dismissed: 'invisible opacity-0 -translate-y-1',
} as const;

const tipClass = computed(() => TIP_CLASSES[tipMode.value]);

// Below md the tooltip spans the row, so its arrow is moved under the pill.
const placeArrow = () => {
  if (!pillEl.value || !tipEl.value) return;
  const pill = pillEl.value.getBoundingClientRect();
  arrowX.value =
    pill.left + pill.width / 2 - tipEl.value.getBoundingClientRect().left - 8;
};

const engage = () => {
  if (tipMode.value === 'dismissed') tipMode.value = 'auto';
  placeArrow();
};

const onEnter = () => {
  hovered.value = true;
  engage();
};

const onFocusIn = () => {
  focused.value = true;
  engage();
};

const onPillClick = () => {
  placeArrow();
  tipMode.value = tipMode.value === 'pinned' ? 'dismissed' : 'pinned';
};

watch([hovered, focused], ([isHovered, isFocused]) => {
  if (!isHovered && !isFocused && tipMode.value === 'pinned') {
    tipMode.value = 'auto';
  }
});

const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || tipMode.value === 'dismissed') return;
  if (tipMode.value === 'pinned' || hovered.value || focused.value) {
    tipMode.value = 'dismissed';
  }
};

const onPointerDown = (event: PointerEvent) => {
  const target = event.target;
  if (target instanceof Node && wrapperEl.value?.contains(target)) return;
  if (tipMode.value === 'pinned' || hovered.value) tipMode.value = 'dismissed';
};

onMounted(() => {
  document.addEventListener('keydown', onKeydown);
  document.addEventListener('pointerdown', onPointerDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown);
  document.removeEventListener('pointerdown', onPointerDown);
});

defineExpose({ focusToggle: () => toggleEl.value?.focus() });
</script>

<template>
  <div class="relative flex items-start gap-1 pt-1 sm:gap-1.5 sm:pt-2">
    <button
      ref="toggle"
      type="button"
      aria-controls="rep-details"
      :aria-expanded="expanded ? 'true' : 'false'"
      aria-label="Detalhes do limite"
      class="flex-none flex items-center justify-center size-11 -ml-3.5 p-0 sm:size-7 sm:-ml-1.5 sm:rounded border-0 bg-transparent text-gray-900 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
      @click="emit('toggle')"
    >
      <ChevronDown
        aria-hidden="true"
        class="block size-4 text-gray-900 transition-transform duration-300 ease-[ease] motion-reduce:transition-none"
        :class="{ '-scale-y-100': expanded }"
      />
    </button>
    <!-- Below md the paragraph is the tooltip's containing block: -left-[46px] (chevron 44 − 14, gap 4, bleed 12;
         from sm -left-10: chevron 28 − 6, gap 6, bleed 12) and -right-3 span the row plus 12px each side, so the
         box never overflows a narrow screen (spec A10). The canvas's pill anchor waits for md: between sm and
         670px the R3 sentence wraps, the pill starts line 2 and a 280px box hung from it overflows on the left.
         From md the pill wrapper is the anchor, as in the canvas. -->

    <p class="relative flex-1 min-w-0 m-0 pt-3 sm:pt-1 text-sm text-red-700">
      <span id="rep-status" class="text-red-700">{{
        LIMIT_ROW_SENTENCES[variant]
      }}</span
      >{{ ' '
      }}<span class="static whitespace-nowrap text-red-700"
        ><strong id="rep-amount" class="font-semibold text-red-700"
          >R$ {{ formatTokens(limitTokens) }}</strong
        ><span
          ref="wrapper"
          class="group/tip static md:relative inline-block align-top ml-1 sm:ml-2"
          @mouseenter="onEnter"
          @mouseleave="hovered = false"
          @focusin="onFocusIn"
          @focusout="focused = false"
          ><button
            ref="pill"
            type="button"
            aria-label="Sobre o limite por compra"
            aria-describedby="rep-tip"
            class="inline-flex items-center h-11 -my-3 px-1 sm:h-auto sm:my-0 sm:px-0 rounded-full border-0 bg-transparent align-top cursor-help focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
            @click="onPillClick"
          >
            <span
              class="flex items-center gap-1 h-5 box-border px-1.5 border border-red-200 rounded-full group-hover/tip:bg-red-100 group-focus-within/tip:bg-red-100"
              :class="tipMode === 'pinned' ? 'bg-red-100' : 'bg-red-50'"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                class="block flex-none text-red-700"
              >
                <circle
                  cx="8"
                  cy="8"
                  r="7.1"
                  stroke="currentColor"
                  stroke-width="1.6"
                />
                <path
                  d="M8 4.4V8.8"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
                <circle cx="8" cy="11.6" r="1" fill="currentColor" />
              </svg>
              <img
                :src="infoIconUrl"
                width="12"
                height="12"
                alt=""
                aria-hidden="true"
                class="block size-3 flex-none"
              />
            </span></button
          ><span
            id="rep-tip"
            ref="tip"
            role="tooltip"
            class="absolute z-30 top-[calc(100%+10px)] -left-[46px] -right-3 sm:-left-10 md:left-auto md:-right-[3px] md:w-[280px] md:max-w-[calc(100vw-24px)] box-border px-3 py-2 rounded bg-white text-base font-medium text-gray-900 text-left whitespace-normal pointer-events-none [filter:drop-shadow(0_0_1px_rgb(0_0_0/0.14))_drop-shadow(0_4px_6px_rgb(0_0_0/0.12))] transition-[opacity,transform,visibility] duration-200 ease-[ease] motion-reduce:transition-none"
            :class="tipClass"
            :style="
              arrowX === null
                ? undefined
                : { '--rep-tip-arrow-x': `${arrowX}px` }
            "
            >Seu limite vem da reputação da sua carteira e cresce a cada compra
            concluída.<svg
              width="16"
              height="9"
              viewBox="0 0 16 9"
              fill="none"
              aria-hidden="true"
              class="absolute -top-2 right-4 max-md:left-(--rep-tip-arrow-x) block"
            >
              <path
                d="M0 9L6.6 1.6C7.35 0.75 8.65 0.75 9.4 1.6L16 9Z"
                fill="#ffffff"
              /></svg></span></span
      ></span>
    </p>
  </div>
</template>

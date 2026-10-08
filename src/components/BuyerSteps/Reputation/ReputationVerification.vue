<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { castCommands, formatTokens, shortContract } from '@/utils/reputation';
import type { ReputationSnapshot } from '@/utils/reputation';

const props = defineProps<{
  snapshot: ReputationSnapshot;
  networkName: string;
}>();

const fallbackEl = useTemplateRef<HTMLTextAreaElement>('fallback');

const commandText = computed(() => castCommands(props.snapshot));
// Bumped on every successful copy so a second copy restarts the 2s "Copiado!" timer.
const copyCount = ref(0);
const copied = ref(false);
const manual = ref(false);

watch(copyCount, (_count, _previous, onCleanup) => {
  copied.value = true;
  const timer = setTimeout(() => {
    copied.value = false;
  }, 2000);
  onCleanup(() => clearTimeout(timer));
});

const onCopied = () => {
  manual.value = false;
  copyCount.value += 1;
};

// navigator.clipboard is missing on insecure origins (some IPFS gateways); never fail silently.
const onCopyFailed = (reason: unknown) => {
  console.error('Copiar comandos: clipboard unavailable', reason);
  copied.value = false;
  manual.value = true;
  void nextTick(() => {
    fallbackEl.value?.focus();
    fallbackEl.value?.select();
  });
};

const copy = () =>
  navigator.clipboard
    ? navigator.clipboard
        .writeText(commandText.value)
        .then(onCopied, onCopyFailed)
    : onCopyFailed(new Error('navigator.clipboard is undefined'));
</script>

<template>
  <div class="flex flex-col gap-2.5">
    <!-- font-mono sits on the labels and values only: the two notes keep the page font (Inter), which
         Tailwind's font-sans is not. -->
    <div
      class="grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-1.5 p-3 rounded-lg bg-white text-xs leading-[18px] text-gray-900 wrap-anywhere"
    >
      <span class="font-mono text-gray-600">Rede</span>
      <span class="font-mono text-gray-900">{{ networkName }}</span>
      <span class="font-mono text-gray-600">Bloco</span>
      <span class="font-mono text-gray-900">#{{ snapshot.blockNumber }}</span>
      <span class="font-mono text-gray-600">P2Pix</span>
      <span class="font-mono text-gray-900">{{
        shortContract(snapshot.p2pix)
      }}</span>
      <span class="font-mono text-gray-600">Reputação</span>
      <span class="text-gray-900"
        ><span class="font-mono">{{ shortContract(snapshot.reputation) }}</span
        >{{ ' '
        }}<span class="block text-xs leading-4 text-gray-600"
          >(lido de P2Pix.reputation)</span
        ></span
      >
      <span class="font-mono text-gray-600">Chave</span>
      <span class="font-mono text-gray-900">endereço &lt;&lt; 12</span>
      <span class="font-mono text-gray-600">Crédito</span>
      <span class="font-mono text-gray-900"
        >R$ {{ formatTokens(snapshot.creditTokens) }}</span
      >
      <span class="font-mono text-gray-600">Limite</span>
      <span class="font-mono text-gray-900"
        >limiter({{ snapshot.creditTokens }}) =
        {{ snapshot.limiterValue }}</span
      >
      <p class="col-span-full mt-1 text-xs leading-4 text-gray-600">
        Para conferir depois, remova --block ou use um RPC de arquivo.
      </p>
    </div>
    <textarea
      v-if="manual"
      ref="fallback"
      readonly
      rows="6"
      aria-label="Comandos cast"
      :value="commandText"
      class="block w-full p-3 rounded-lg border-0 bg-white font-mono text-xs leading-[18px] text-gray-900 resize-none wrap-anywhere focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
    ></textarea>
    <div class="flex items-center gap-2">
      <!-- Below sm the button is a 44px tap target; the inner span carries the visual chip. -->
      <button
        type="button"
        class="group/copy flex items-center min-h-11 sm:min-h-0 p-0 border-0 rounded-lg bg-transparent cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-800"
        @click="copy"
      >
        <span
          class="flex items-center gap-[5px] px-2 py-1 sm:gap-1.5 sm:px-2.5 sm:py-[5px] border border-transparent rounded-lg bg-gray-200 group-hover/copy:bg-gray-300 text-[11px] leading-[14px] sm:text-xs sm:leading-4 font-semibold text-gray-900 whitespace-nowrap"
        >
          <svg
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
            class="block flex-none size-[11px] sm:size-3 text-gray-900"
          >
            <path
              fill-rule="evenodd"
              clip-rule="evenodd"
              d="M5.5 0C4.67157 0 4 0.671573 4 1.5V3H5V1.5C5 1.22386 5.22386 1 5.5 1H12.5C12.7761 1 13 1.22386 13 1.5V8.5C13 8.77614 12.7761 9 12.5 9H5.5C5.22386 9 5 8.77614 5 8.5V7H4V8.5C4 9.32843 4.67157 10 5.5 10H12.5C13.3284 10 14 9.32843 14 8.5V1.5C14 0.671573 13.3284 0 12.5 0H5.5ZM9 12.5C9 12.7761 8.77614 13 8.5 13L1.5 13C1.22386 13 1 12.7761 1 12.5L1 5.5C1 5.22386 1.22386 5 1.5 5L8.5 5C8.77614 5 9 5.22386 9 5.5V8H10V5.5C10 4.67157 9.32843 4 8.5 4L1.5 4C0.671574 4 0 4.67157 0 5.5V12.5C0 13.3284 0.671573 14 1.5 14L8.5 14C9.32843 14 10 13.3284 10 12.5V12H9V12.5Z"
              fill="currentColor"
            />
          </svg>
          Copiar comandos
        </span>
      </button>
      <span role="status" class="flex min-w-0 text-xs text-gray-900">
        <span
          v-if="copied"
          class="px-1.5 py-0.5 rounded bg-white shadow-xs text-xs font-semibold text-emerald-700"
          >Copiado!</span
        >
        <span v-else-if="manual" class="text-xs text-gray-900"
          >Selecionado — copie com Ctrl+C</span
        >
      </span>
    </div>
  </div>
</template>

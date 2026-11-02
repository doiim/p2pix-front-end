<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { searchBuyTokens } from '@/model/BuyToken';
import { useUser } from '@/composables/useUser';
import { getTokenImage } from '@/utils/imagesPath';
import ChevronDown from '@/assets/chevronDown.svg';
import SearchIcon from '@/assets/search.svg';
import CheckIcon from '@/assets/check.svg';

const selected = defineModel<string>({ required: true });

const open = ref(false);
const query = ref('');
const rootRef = ref<HTMLElement | null>(null);
const searchRef = ref<HTMLInputElement | null>(null);

const network = useUser().network;
const tokens = computed(() => searchBuyTokens(query.value, network.value));

const toggle = async (): Promise<void> => {
  open.value = !open.value;
  query.value = '';
  await nextTick();
  searchRef.value?.focus();
};

const choose = (symbol: string): void => {
  selected.value = symbol;
  open.value = false;
};

onClickOutside(rootRef, () => {
  open.value = false;
});
</script>

<template>
  <div
    ref="rootRef"
    class="relative shrink-0 overflow-visible ml-auto sm:ml-0"
    @keydown.esc="open = false"
  >
    <button
      type="button"
      class="flex flex-row shrink-0 items-center py-2 pl-2 pr-4 bg-gray-300 hover:bg-gray-200 focus:outline-indigo-800 focus:outline-2 rounded-full min-w-fit gap-2 transition-colors"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="toggle"
    >
      <img
        :alt="`${selected} logo`"
        class="w-7 h-7"
        :src="getTokenImage(selected)"
      />
      <span class="text-gray-900 text-lg font-medium" id="token">{{
        selected
      }}</span>
      <ChevronDown
        class="shrink-0 text-gray-700 transition-all duration-500 ease-in-out"
        :class="{ 'scale-y-[-1]': open }"
        alt="Expandir"
      />
    </button>
    <transition name="dropdown">
      <div
        v-if="open"
        class="mt-2 absolute right-0 z-50 w-63 bg-white rounded-lg border border-gray-200 shadow-lg p-2 text-gray-900"
      >
        <label class="relative block mb-1">
          <SearchIcon
            class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          />
          <input
            ref="searchRef"
            v-model="query"
            type="search"
            class="w-full border border-gray-300 rounded-lg py-2.5 pl-10 pr-3 text-base text-gray-900 placeholder:text-gray-500 outline-none focus:border-gray-400"
            placeholder="Buscar token"
            aria-label="Buscar token"
            @keydown.enter.prevent="tokens[0] && choose(tokens[0].symbol)"
          />
        </label>
        <ul role="listbox" class="max-h-80 overflow-y-auto">
          <li
            v-for="token in tokens"
            :key="token.symbol"
            role="option"
            tabindex="0"
            :aria-selected="token.symbol === selected"
            class="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-gray-100 focus:bg-gray-100 outline-none transition-colors"
            :class="{ 'bg-gray-100': token.symbol === selected }"
            @click="choose(token.symbol)"
            @keydown.enter.prevent="choose(token.symbol)"
          >
            <img
              :alt="`${token.symbol} logo`"
              width="32"
              height="32"
              :src="getTokenImage(token.symbol)"
            />
            <div class="flex flex-col flex-1 min-w-0 leading-tight">
              <span class="text-base font-semibold text-gray-900">{{
                token.symbol
              }}</span>
              <span class="text-xs text-gray-500 truncate">{{
                token.name
              }}</span>
            </div>
            <CheckIcon v-if="token.symbol === selected" aria-hidden="true" />
          </li>
          <li
            v-if="tokens.length === 0"
            class="px-3 py-4 text-sm text-gray-500 text-center"
          >
            Nenhum token encontrado
          </li>
        </ul>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts" generic="T">
import { ref, computed } from "vue";
import { onClickOutside } from "@vueuse/core";
import ChevronDown from "@/assets/chevronDown.svg";

export interface DropdownItem<T = any> {
  value: T;
  label: string;
  icon?: string;
  disabled?: boolean;
}

const props = withDefaults(
  defineProps<{
    items: DropdownItem<T>[];
    modelValue: T;
    placeholder?: string;
    searchable?: boolean;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    showIcon?: boolean;
  }>(),
  {
    placeholder: "Selecione...",
    searchable: false,
    disabled: false,
    size: "md",
    showIcon: true,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: T];
  change: [value: T];
}>();

const isOpen = ref(false);
const searchQuery = ref("");
const dropdownRef = ref<HTMLElement | null>(null);

const selectedItem = computed(() => {
  return props.items.find((item) => item.value === props.modelValue);
});

const filteredItems = computed(() => {
  if (!props.searchable || !searchQuery.value) {
    return props.items;
  }
  
  const query = searchQuery.value.toLowerCase();
  return props.items.filter((item) =>
    item.label.toLowerCase().includes(query)
  );
});

const toggleDropdown = () => {
  if (!props.disabled) {
    isOpen.value = !isOpen.value;
    if (!isOpen.value) {
      searchQuery.value = "";
    }
  }
};

const selectItem = (item: DropdownItem<T>) => {
  if (!item.disabled) {
    emit("update:modelValue", item.value);
    emit("change", item.value);
    isOpen.value = false;
    searchQuery.value = "";
  }
};

onClickOutside(dropdownRef, () => {
  isOpen.value = false;
  searchQuery.value = "";
});
</script>

<template>
  <div ref="dropdownRef" class="dropdown-container">
    <button
      type="button"
      :class="[
        'dropdown-trigger',
        `size-${size}`,
        { disabled: disabled, open: isOpen },
      ]"
      @click="toggleDropdown"
    >
      <img
        v-if="selectedItem?.icon && showIcon"
        :src="selectedItem.icon"
        :alt="selectedItem.label"
        class="item-icon"
      />
      <span class="selected-text">
        {{ selectedItem?.label || placeholder }}
      </span>
      <ChevronDown
        class="chevron"
        :class="{ rotated: isOpen }"
      />
    </button>

    <transition name="dropdown-fade">
      <div v-if="isOpen" class="dropdown-menu">
        <input
          v-if="searchable"
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Buscar..."
          @click.stop
        />
        
        <div class="items-container">
          <div
            v-for="item in filteredItems"
            :key="String(item.value)"
            :class="[
              'dropdown-item',
              {
                selected: item.value === modelValue,
                disabled: item.disabled,
              },
            ]"
            @click="selectItem(item)"
          >
            <img
              v-if="item.icon && showIcon"
              :src="item.icon"
              :alt="item.label"
              class="item-icon"
            />
            <span class="item-label">{{ item.label }}</span>
          </div>
          
          <div v-if="filteredItems.length === 0" class="no-results">
            Nenhum resultado encontrado
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.dropdown-container {
  @apply relative inline-block;
}

.dropdown-trigger {
  @apply flex items-center gap-2 bg-gray-300 hover:bg-gray-200 rounded-3xl transition-colors cursor-pointer border-none outline-none;
}

.dropdown-trigger:focus {
  @apply outline-2 outline-indigo-800;
}

.dropdown-trigger.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.dropdown-trigger.disabled:hover {
  @apply bg-gray-300;
}

.size-sm {
  @apply px-2 py-1 text-sm;
}

.size-md {
  @apply px-3 py-2 text-base;
}

.size-lg {
  @apply px-4 py-3 text-lg;
}

.item-icon {
  @apply sm:w-fit w-4 flex-shrink-0;
}

.selected-text {
  @apply text-gray-900 font-medium min-w-fit;
}

.chevron {
  @apply transition-transform duration-300 invert pr-1;
}

.chevron.rotated {
  @apply rotate-180;
}

.dropdown-menu {
  @apply absolute right-0 mt-2 bg-white rounded-xl border border-gray-300 shadow-md z-50 min-w-max w-full;
}

.search-input {
  @apply w-full px-4 py-3 border-b border-gray-200 outline-none text-gray-900;
}

.search-input:focus {
  @apply border-indigo-800;
}

.items-container {
  @apply max-h-64 overflow-y-auto;
}

.dropdown-item {
  @apply flex items-center gap-2 px-4 py-4 cursor-pointer hover:bg-gray-300 transition-colors text-gray-900 font-semibold text-sm;
}

.dropdown-item.selected {
  @apply bg-gray-100;
}

.dropdown-item.disabled {
  @apply opacity-50 cursor-not-allowed;
}

.dropdown-item.disabled:hover {
  @apply bg-transparent;
}

.item-label {
  @apply text-end;
}

.no-results {
  @apply px-4 py-6 text-center text-gray-500 text-sm;
}

/* Animação */
.dropdown-fade-enter-active,
.dropdown-fade-leave-active {
  @apply transition-all duration-200;
}

.dropdown-fade-enter-from,
.dropdown-fade-leave-to {
  @apply opacity-0 -translate-y-2;
}
</style>


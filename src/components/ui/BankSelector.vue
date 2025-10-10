<script setup lang="ts">
import { computed } from "vue";
import bankList from "@/utils/files/isbpList.json";

export interface Bank {
  ISPB: string;
  longName: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string | null;
    disabled?: boolean;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    placeholder: "Busque e selecione seu banco",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [bank: Bank];
}>();

const bankItems = computed(() => {
  return bankList.map((bank) => ({
    value: bank.ISPB,
    label: bank.longName,
    bank: bank,
  }));
});

const selectedItem = computed(() => {
  if (!props.modelValue) return null;
  return bankItems.value.find((item) => item.value === props.modelValue);
});

const searchQuery = computed({
  get: () => selectedItem.value?.label || "",
  set: (value: string) => {
    // Handled by input
  },
});

const filteredBanks = computed(() => {
  if (!searchQuery.value) return [];
  
  const query = searchQuery.value.toLowerCase();
  return bankList
    .filter((bank) => bank.longName.toLowerCase().includes(query))
    .slice(0, 10);
});

const showBankList = computed(() => {
  return filteredBanks.value.length > 0 && searchQuery.value.length > 0;
});

const selectBank = (bank: Bank) => {
  emit("update:modelValue", bank.ISPB);
  emit("change", bank);
};
</script>

<template>
  <div class="bank-selector">
    <input
      type="text"
      v-model="searchQuery"
      :placeholder="placeholder"
      :disabled="disabled"
      class="bank-input"
      autocomplete="off"
    />
    
    <transition name="dropdown-fade">
      <div v-if="showBankList" class="bank-list">
        <div
          v-for="bank in filteredBanks"
          :key="bank.ISPB"
          class="bank-item"
          @click="selectBank(bank)"
        >
          <span class="bank-name">{{ bank.longName }}</span>
          <span class="bank-ispb">{{ bank.ISPB }}</span>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.bank-selector {
  @apply relative w-full;
}

.bank-input {
  @apply w-full px-4 py-3 border-none outline-none rounded-lg bg-white text-gray-900 text-sm;
}

.bank-input:focus {
  @apply ring-2 ring-indigo-800;
}

.bank-input:disabled {
  @apply opacity-50 cursor-not-allowed bg-gray-100;
}

.bank-list {
  @apply absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-gray-300 shadow-lg z-50 max-h-64 overflow-y-auto;
}

.bank-item {
  @apply flex justify-between items-center px-4 py-3 cursor-pointer hover:bg-gray-100 transition-colors;
}

.bank-name {
  @apply text-gray-900 font-medium text-sm flex-1;
}

.bank-ispb {
  @apply text-gray-500 text-xs ml-2;
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


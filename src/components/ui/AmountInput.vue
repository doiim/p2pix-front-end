<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { TokenEnum } from "@/model/NetworkEnum";
import { decimalCount } from "@/utils/decimalCount";
import { debounce } from "@/utils/debounce";
import TokenSelector from "./TokenSelector.vue";
import ErrorMessage from "./ErrorMessage.vue";

const props = withDefaults(
  defineProps<{
    modelValue: number;
    selectedToken: TokenEnum;
    placeholder?: string;
    showTokenSelector?: boolean;
    showConversion?: boolean;
    conversionRate?: number;
    minValue?: number;
    maxValue?: number;
    disabled?: boolean;
    required?: boolean;
  }>(),
  {
    placeholder: "0",
    showTokenSelector: true,
    showConversion: true,
    conversionRate: 1,
    minValue: 0,
    disabled: false,
    required: false,
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
  "update:selectedToken": [token: TokenEnum];
  error: [message: string | null];
  valid: [isValid: boolean];
}>();

const inputValue = ref<string>(String(props.modelValue || ""));
const validDecimals = ref(true);
const validRange = ref(true);

const convertedValue = computed(() => {
  return (props.modelValue * props.conversionRate).toFixed(2);
});

const errorMessage = computed(() => {
  if (!validDecimals.value) {
    return "Por favor utilize no máximo 2 casas decimais";
  }
  if (!validRange.value) {
    if (props.minValue && props.modelValue < props.minValue) {
      return `Valor mínimo: ${props.minValue}`;
    }
    if (props.maxValue && props.modelValue > props.maxValue) {
      return `Valor máximo: ${props.maxValue}`;
    }
  }
  return null;
});

const isValid = computed(() => {
  return validDecimals.value && validRange.value;
});

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;
  inputValue.value = value;
  
  const numValue = Number(value);
  
  // Validar decimais
  if (decimalCount(value) > 2) {
    validDecimals.value = false;
    emit("error", "Por favor utilize no máximo 2 casas decimais");
    emit("valid", false);
    return;
  }
  validDecimals.value = true;
  
  // Validar range
  if (props.minValue !== undefined && numValue < props.minValue) {
    validRange.value = false;
    emit("error", `Valor mínimo: ${props.minValue}`);
    emit("valid", false);
    return;
  }
  if (props.maxValue !== undefined && numValue > props.maxValue) {
    validRange.value = false;
    emit("error", `Valor máximo: ${props.maxValue}`);
    emit("valid", false);
    return;
  }
  validRange.value = true;
  
  emit("update:modelValue", numValue);
  emit("error", null);
  emit("valid", true);
};

const debouncedHandleInput = debounce(handleInput, 500);

const handleTokenChange = (token: TokenEnum) => {
  emit("update:selectedToken", token);
};

watch(() => props.modelValue, (newVal) => {
  if (newVal !== Number(inputValue.value)) {
    inputValue.value = String(newVal || "");
  }
});
</script>

<template>
  <div class="amount-input-container">
    <div class="input-row">
      <input
        type="number"
        :value="inputValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        class="amount-input"
        :class="{
          'font-semibold text-xl': modelValue > 0,
          'has-error': !isValid,
        }"
        step="0.01"
        @input="debouncedHandleInput"
      />
      
      <TokenSelector
        v-if="showTokenSelector"
        :model-value="selectedToken"
        :disabled="disabled"
        size="md"
        @update:model-value="handleTokenChange"
      />
      
      <div v-else class="token-display">
        {{ selectedToken }}
      </div>
    </div>
    
    <div class="divider"></div>
    
    <div class="info-row">
      <p v-if="showConversion" class="conversion-text">
        ~ R$ {{ convertedValue }}
      </p>
      <slot name="extra-info"></slot>
    </div>
    
    <ErrorMessage
      v-if="errorMessage"
      :message="errorMessage"
      type="error"
    />
  </div>
</template>

<style scoped>
.amount-input-container {
  @apply flex flex-col w-full gap-2;
}

.input-row {
  @apply flex justify-between items-center w-full gap-4;
}

.amount-input {
  @apply border-none outline-none text-lg text-gray-900 flex-1 bg-transparent;
  appearance: textfield;
  -moz-appearance: textfield;
}

.amount-input::-webkit-inner-spin-button,
.amount-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

.amount-input:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.amount-input.has-error {
  @apply text-red-500;
}

.token-display {
  @apply flex items-center px-3 py-2 bg-gray-300 rounded-3xl min-w-fit text-gray-900 font-medium;
}

.divider {
  @apply w-full border-b border-gray-300 my-2;
}

.info-row {
  @apply flex justify-between items-center;
}

.conversion-text {
  @apply text-gray-500 font-normal text-sm;
}
</style>


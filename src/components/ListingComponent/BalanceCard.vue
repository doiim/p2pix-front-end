<script setup lang="ts">
import type { ValidDeposit } from "@/model/ValidDeposit";
import { ref, watch, onMounted, computed } from "vue";
import { debounce } from "@/utils/debounce";
import { decimalCount } from "@/utils/decimalCount";
import { useFloating, arrow, offset, flip, shift } from "@floating-ui/vue";
import IconButton from "../ui/IconButton.vue";
import withdrawIcon from "@/assets/withdraw.svg?url";

const props = defineProps<{
  validDeposits: ValidDeposit[];
  activeLockAmount: number;
  selectedToken: string;
}>();

const emit = defineEmits<{
  withdraw: [amount: string];
}>();

const withdrawAmount = ref<string>("");
const isCollapsibleOpen = ref<boolean>(false);
const validDecimals = ref<boolean>(true);
const validWithdrawAmount = ref<boolean>(true);
const enableConfirmButton = ref<boolean>(false);
const showInfoTooltip = ref<boolean>(false);
const floatingArrow = ref(null);

const reference = ref<HTMLElement | null>(null);
const floating = ref<HTMLElement | null>(null);
const infoText = ref<HTMLElement | null>(null);

const remaining = computed(() => {
  if (props.validDeposits.length > 0) {
    const deposit = props.validDeposits[0];
    return deposit ? deposit.remaining : 0;
  }
  return 0;
});

const handleInputEvent = (event: any): void => {
  const { value } = event.target;

  if (decimalCount(String(value)) > 2) {
    validDecimals.value = false;
    enableConfirmButton.value = false;
    return;
  }
  validDecimals.value = true;

  if (value > remaining.value) {
    validWithdrawAmount.value = false;
    enableConfirmButton.value = false;
    return;
  }
  validWithdrawAmount.value = true;
  enableConfirmButton.value = true;
};

const callWithdraw = () => {
  if (enableConfirmButton.value && withdrawAmount.value) {
    emit("withdraw", withdrawAmount.value);
    // Reset form after withdraw
    withdrawAmount.value = "";
    isCollapsibleOpen.value = false;
  }
};

const openWithdrawForm = () => {
  isCollapsibleOpen.value = true;
};

const cancelWithdraw = () => {
  isCollapsibleOpen.value = false;
  withdrawAmount.value = "";
  validDecimals.value = true;
  validWithdrawAmount.value = true;
  enableConfirmButton.value = false;
};

onMounted(() => {
  useFloating(reference, floating, {
    placement: "right",
    middleware: [
      offset(10),
      flip(),
      shift(),
      arrow({ element: floatingArrow }),
    ],
  });
});
</script>

<template>
  <div class="w-full bg-white p-4 sm:p-6 rounded-lg">
    <div class="flex justify-between items-center">
      <div>
        <p class="text-sm leading-5 font-medium text-gray-600">
          Saldo disponível
        </p>
        <p class="text-xl leading-7 font-semibold text-gray-900">
          {{ remaining }} {{ selectedToken }}
        </p>
        <div class="flex gap-2 w-32 sm:w-56" v-if="activeLockAmount != 0">
          <span class="text-xs font-normal text-gray-400" ref="infoText">
            {{ `com ${activeLockAmount.toFixed(2)} ${selectedToken} em lock` }}
          </span>
          <div
            class="absolute mt-[2px] md-view"
            :style="{ left: `${(infoText?.clientWidth ?? 108) + 4}px` }"
          >
            <img
              alt="info image"
              src="@/assets/info.svg?url"
              aria-describedby="tooltip"
              ref="reference"
              @mouseover="showInfoTooltip = true"
              @mouseout="showInfoTooltip = false"
            />
            <div
              role="tooltip"
              ref="floating"
              class="w-56 z-50 tooltip md-view"
              v-if="showInfoTooltip"
            >
              Valor "em lock" significa que a quantia está aguardando
              confirmação de compra e só estará disponível para saque caso a
              transação expire.
            </div>
          </div>
        </div>
      </div>
      <div v-show="!isCollapsibleOpen" class="flex justify-end items-center">
        <IconButton
          text="Sacar"
          :icon="withdrawIcon"
          variant="outline"
          size="md"
          :full-width="false"
          @click="openWithdrawForm"
        />
      </div>
    </div>
    <div class="pt-5">
      <div v-show="isCollapsibleOpen" class="py-2 w-100">
        <p class="text-sm leading-5 font-medium">Valor do saque</p>
        <input
          type="number"
          @input="debounce(handleInputEvent, 500)($event)"
          placeholder="0"
          class="text-2xl text-gray-900 w-full outline-none"
          v-model="withdrawAmount"
        />
      </div>
      <div class="flex justify-center" v-if="!validDecimals">
        <span class="text-red-500 font-normal text-sm">
          Por favor utilize no máximo 2 casas decimais
        </span>
      </div>
      <div class="flex justify-center" v-else-if="!validWithdrawAmount">
        <span class="text-red-500 font-normal text-sm">
          Saldo insuficiente
        </span>
      </div>
      <hr v-show="isCollapsibleOpen" class="pb-3" />
      <div
        v-show="isCollapsibleOpen"
        class="flex justify-between items-center"
      >
        <h1
          @click="cancelWithdraw"
          class="text-black font-medium cursor-pointer hover:text-gray-600 transition-colors"
        >
          Cancelar
        </h1>

        <IconButton
          text="Sacar"
          :icon="withdrawIcon"
          variant="outline"
          size="md"
          :full-width="false"
          :disabled="!enableConfirmButton"
          @click="callWithdraw"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
p {
  @apply text-gray-900;
}

.tooltip {
  @apply bg-white text-gray-900 font-medium text-xs md:text-base px-3 py-2 rounded border-2 border-emerald-500 left-5 top-[-3rem];
}

input[type="number"] {
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

@media screen and (max-width: 640px) {
  .md-view {
    display: none;
  }
}
</style>


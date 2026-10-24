<script setup lang="ts">
import type { ValidDeposit } from '@/model/ValidDeposit';
import { ref, computed } from 'vue';
import { decimalCount } from '@/utils/decimalCount';
import IconButton from '../ui/IconButton.vue';
import withdrawIcon from '@/assets/withdraw.svg?url';

const props = withDefaults(
  defineProps<{
    validDeposits: ValidDeposit[];
    activeLockAmount: number;
    selectedToken: string;
    expiredLocksCount?: number;
    sweeping?: boolean;
  }>(),
  { expiredLocksCount: 0, sweeping: false },
);

const emit = defineEmits<{
  withdraw: [amount: string];
  sweepExpired: [];
}>();

const withdrawAmount = ref<string>('');
const isCollapsibleOpen = ref<boolean>(false);

const remaining = computed(() => {
  if (props.validDeposits.length > 0) {
    const deposit = props.validDeposits[0];
    return deposit ? deposit.remaining : 0;
  }
  return 0;
});

// The amount leaves as the decimal string `parseEther` consumes, so it stays a
// string from the input down (text + inputmode instead of a number input) and
// the pattern below is the accepted grammar.
const enteredAmount = computed(() => Number(withdrawAmount.value));
const validDecimals = computed(() => decimalCount(withdrawAmount.value) <= 2);
// NaN-safe on purpose: garbage input keeps the button off without claiming
// "Saldo insuficiente".
const validWithdrawAmount = computed(
  () => !(enteredAmount.value > remaining.value),
);
const enableConfirmButton = computed(
  () =>
    /^(\d+|\d*\.\d{1,2})$/.test(withdrawAmount.value) &&
    enteredAmount.value > 0 &&
    validWithdrawAmount.value,
);

const callWithdraw = () => {
  if (!enableConfirmButton.value) return;
  emit('withdraw', withdrawAmount.value);
  // Reset form after withdraw
  withdrawAmount.value = '';
  isCollapsibleOpen.value = false;
};

const openWithdrawForm = () => {
  isCollapsibleOpen.value = true;
};

const cancelWithdraw = () => {
  isCollapsibleOpen.value = false;
  withdrawAmount.value = '';
};
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
            {{
              `com ${activeLockAmount.toFixed(2)} ${selectedToken} reservados`
            }}
          </span>
          <div class="absolute mt-[2px] md-view group">
            <img
              alt="Mais informações"
              src="@/assets/info.svg?url"
              aria-describedby="tooltip"
            />
            <div
              role="tooltip"
              class="w-56 z-50 tooltip md-view hidden group-hover:block"
            >
              Valor "reservado" significa que a quantia está aguardando
              confirmação de compra e só estará disponível para saque caso a
              reserva expire.
            </div>
          </div>
        </div>
        <div v-if="expiredLocksCount > 0" class="flex items-center gap-2 mt-2">
          <span class="text-xs font-normal text-amber-600">
            {{
              `${expiredLocksCount} reserva(s) expirada(s) — recupere para o saldo`
            }}
          </span>
          <IconButton
            :text="sweeping ? 'Recuperando...' : 'Recuperar'"
            variant="outline"
            size="md"
            :full-width="false"
            :disabled="sweeping"
            @click="emit('sweepExpired')"
          />
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
          type="text"
          inputmode="decimal"
          placeholder="0"
          class="text-2xl text-gray-900 w-full outline-none"
          v-model.trim="withdrawAmount"
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
      <div v-show="isCollapsibleOpen" class="flex justify-between items-center">
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
@reference "tailwindcss";
p {
  @apply text-gray-900;
}

.tooltip {
  @apply bg-white text-gray-900 font-medium text-xs md:text-base px-3 py-2 rounded border-2 border-emerald-500 left-5 top-[-3rem];
}

@media screen and (max-width: 640px) {
  .md-view {
    display: none;
  }
}
</style>

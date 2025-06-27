<script setup lang="ts">
import { NetworkEnum } from "@/model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { WalletTransaction } from "@/model/WalletTransaction";
import { useUser } from "@/composables/useUser";
import { ref, watch, onMounted } from "vue";
import SpinnerComponent from "../SpinnerComponent.vue";
import { decimalCount } from "@/utils/decimalCount";
import { debounce } from "@/utils/debounce";
import { useFloating, arrow, offset, flip, shift } from "@floating-ui/vue";

const user = useUser();

// props
const props = defineProps<{
  validDeposits: ValidDeposit[];
  walletTransactions: WalletTransaction[];
  activeLockAmount: number;
}>();

const emit = defineEmits(["depositWithdrawn"]);

const { loadingWalletTransactions } = user;

const remaining = ref<number>(0);
const itemsToShow = ref<WalletTransaction[]>([]);
const withdrawAmount = ref<string>("");
const withdrawButtonOpacity = ref<number>(0.6);
const withdrawButtonCursor = ref<string>("not-allowed");
const isCollapsibleOpen = ref<boolean>(false);
const validDecimals = ref<boolean>(true);
const validWithdrawAmount = ref<boolean>(true);
const enableConfirmButton = ref<boolean>(false);
const showInfoTooltip = ref<boolean>(false);
const floatingArrow = ref(null);

const reference = ref<HTMLElement | null>(null);
const floating = ref<HTMLElement | null>(null);
const infoText = ref<HTMLElement | null>(null);

// Debounce methods
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
  emit("depositWithdrawn", withdrawAmount.value);
};

watch(enableConfirmButton, (): void => {
  if (!enableConfirmButton.value) {
    withdrawButtonOpacity.value = 0.7;
    withdrawButtonCursor.value = "not-allowed";
  } else {
    withdrawButtonOpacity.value = 1;
    withdrawButtonCursor.value = "pointer";
  }
});

watch(withdrawAmount, (): void => {
  if (!withdrawAmount.value || !enableConfirmButton.value) {
    withdrawButtonOpacity.value = 0.7;
    withdrawButtonCursor.value = "not-allowed";
  } else {
    withdrawButtonOpacity.value = 1;
    withdrawButtonCursor.value = "pointer";
  }
});

const getRemaining = (): number => {
  if (props.validDeposits.length > 0) {
    // in this release only the BRL token is being used.
    const deposit = props.validDeposits[0];
    remaining.value = deposit ? deposit.remaining : 0;
    return deposit ? deposit.remaining : 0;
  }
  return 0;
};

const getExplorer = (): string => {
  return user.networkName.value == NetworkEnum.sepolia
    ? "Etherscan"
    : "Polygonscan";
};

const showInitialItems = (): void => {
  itemsToShow.value = props.walletTransactions.slice(0, 3);
};

const openEtherscanUrl = (transactionHash: string): void => {
  const networkUrl =
    user.networkName.value == NetworkEnum.sepolia
      ? "sepolia.etherscan.io"
      : "mumbai.polygonscan.com";
  const url = `https://${networkUrl}/tx/${transactionHash}`;
  window.open(url, "_blank");
};

const loadMore = (): void => {
  const itemsShowing = itemsToShow.value.length;
  itemsToShow.value?.push(
    ...props.walletTransactions.slice(itemsShowing, itemsShowing + 3)
  );
};

const getEventName = (event: string | undefined): string => {
  if (!event) return "Desconhecido";

  const possibleEventName: { [key: string]: string } = {
    DepositAdded: "Oferta",
    LockAdded: "Reserva",
    LockReleased: "Compra",
    DepositWithdrawn: "Retirada",
  };

  return possibleEventName[event];
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

// watch props changes
watch(props, async (): Promise<void> => {
  const itemsToShowQty = itemsToShow.value.length;
  if (itemsToShowQty == 0) showInitialItems();
  else
    itemsToShow.value =
      props.walletTransactions.length > itemsToShowQty
        ? props.walletTransactions.slice(0, itemsToShowQty)
        : props.walletTransactions;
});

// initial itemsToShow valueb
showInitialItems();
</script>

<template>
  <div class="main-container max-w-md" v-if="loadingWalletTransactions">
    <SpinnerComponent width="8" height="8"></SpinnerComponent>
  </div>
  <div class="main-container max-w-md" v-if="!loadingWalletTransactions">
    <div
      class="w-full bg-white p-4 sm:p-6 rounded-lg"
      v-if="props.validDeposits.length > 0"
    >
      <div class="flex justify-between items-center">
        <div>
          <p class="text-sm leading-5 font-medium text-gray-600">
            Saldo disponível
          </p>
          <p class="text-xl leading-7 font-semibold text-gray-900">
            {{ getRemaining() }} {{ user.selectedToken.value }}
          </p>
          <div class="flex gap-2 w-32 sm:w-56" v-if="activeLockAmount != 0">
            <span class="text-xs font-normal text-gray-400" ref="infoText">{{
              `com ${activeLockAmount.toFixed(2)} ${
                user.selectedToken.value
              } em lock`
            }}</span>
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
                Valor “em lock” significa que a quantia está aguardando
                confirmação de compra e só estará disponível para saque caso a
                transação expire.
              </div>
            </div>
          </div>
        </div>
        <div v-show="!isCollapsibleOpen" class="flex justify-end items-center">
          <div
            class="flex gap-2 cursor-pointer items-center justify-self-center border-2 p-2 border-amber-300 rounded-md"
            @click="[(isCollapsibleOpen = true)]"
          >
            <img
              alt="Withdraw image"
              src="@/assets/withdraw.svg?url"
              class="w-3 h-3 sm:w-4 sm:h-4"
            />
            <span class="last-release-info">Sacar</span>
          </div>
        </div>
      </div>
      <div class="pt-5">
        <div v-show="isCollapsibleOpen" class="py-2 w-100">
          <p class="text-sm leading-5 font-medium">Valor do saque</p>
          <input
            type="number"
            name=""
            @input="debounce(handleInputEvent, 500)($event)"
            placeholder="0"
            class="text-2xl text-gray-900 w-full outline-none"
            v-model="withdrawAmount"
          />
        </div>
        <div class="flex justify-center" v-if="!validDecimals">
          <span class="text-red-500 font-normal text-sm"
            >Por favor utilize no máximo 2 casas decimais</span
          >
        </div>
        <div class="flex justify-center" v-else-if="!validWithdrawAmount">
          <span class="text-red-500 font-normal text-sm"
            >Saldo insuficiente</span
          >
        </div>
        <hr v-show="isCollapsibleOpen" class="pb-3" />
        <div
          v-show="isCollapsibleOpen"
          class="flex justify-between items-center"
        >
          <h1
            @click="[(isCollapsibleOpen = false)]"
            class="text-black font-medium cursor-pointer"
          >
            Cancelar
          </h1>

          <div
            class="withdraw-button flex gap-2 items-center justify-self-center border-2 p-2 border-amber-300 rounded-md"
            @click="callWithdraw"
          >
            <img
              alt="Withdraw image"
              src="@/assets/withdraw.svg?url"
              class="w-3 h-3 sm:w-4 sm:h-4"
            />
            <span class="last-release-info">Sacar</span>
          </div>
        </div>
      </div>
    </div>
    <div
      class="w-full bg-white p-4 sm:p-6 rounded-lg"
      v-for="item in itemsToShow"
      :key="item.blockNumber"
    >
      <div class="item-container">
        <div class="flex flex-col self-start">
          <span class="text-xs sm:text-sm leading-5 font-medium text-gray-600">
            {{ getEventName(item.event) }}
          </span>
          <span
            class="text-xl sm:text-xl leading-7 font-semibold text-gray-900"
          >
            {{ item.amount }}
            <!-- {{ getTokenByAddress(item.token) }} -->
          </span>
        </div>
        <div class="flex flex-col items-center justify-center">
          <div
            class="bg-amber-300 status-text"
            v-if="getEventName(item.event) == 'Reserva' && item.lockStatus == 1"
          >
            Em Aberto
          </div>
          <div
            class="bg-[#94A3B8] status-text"
            v-if="getEventName(item.event) == 'Reserva' && item.lockStatus == 2"
          >
            Expirado
          </div>
          <div
            class="bg-emerald-300 status-text"
            v-if="
              (getEventName(item.event) == 'Reserva' && item.lockStatus == 3) ||
              getEventName(item.event) != 'Reserva'
            "
          >
            Finalizado
          </div>
          <div
            class="flex gap-2 cursor-pointer items-center justify-self-center w-full"
            @click="openEtherscanUrl(item.transactionHash)"
            v-if="getEventName(item.event) != 'Reserva' || item.lockStatus != 1"
          >
            <span class="last-release-info">{{ getExplorer() }}</span>
            <img
              alt="Redirect image"
              src="@/assets/redirect.svg?url"
              class="w-3 h-3 sm:w-4 sm:h-4"
            />
          </div>
          <div
            class="flex gap-2 justify-self-center w-full"
            v-if="getEventName(item.event) == 'Reserva' && item.lockStatus == 1"
          >
            <RouterLink
              :to="{
                name: 'home',
                force: true,
                state: { lockID: item.transactionID },
              }"
              class="router-button"
              >Continuar</RouterLink
            >
          </div>
        </div>
      </div>
    </div>
    <div
      class="flex flex-col justify-center items-center w-full mt-2 gap-2"
      v-if="
        itemsToShow.length != 0 &&
        itemsToShow.length != props.walletTransactions.length
      "
    >
      <button
        type="button"
        class="text-white font-semibold"
        @click="loadMore()"
      >
        Carregar mais
      </button>
      <span class="text-gray-300">
        ({{ itemsToShow.length }} de {{ props.walletTransactions.length }}
        transações )
      </span>
    </div>

    <span class="font-bold text-gray-300" v-if="itemsToShow.length == 0">
      Não há nenhuma transação anterior
    </span>
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

p {
  @apply text-gray-900;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.item-container {
  @apply flex justify-between items-center;
}

.status-text {
  @apply text-xs sm:text-base font-medium text-gray-900 rounded-lg text-center mb-2 px-2 py-1 mt-4;
}
.text {
  @apply text-white text-center;
}

.grid-container {
  @apply grid grid-cols-4 grid-flow-row items-center px-8 py-6 gap-4 rounded-lg shadow-md shadow-gray-600 backdrop-blur-md mt-10 w-auto;
}

.last-release-info {
  @apply font-medium text-xs sm:text-sm text-gray-900 justify-self-center;
}

.tooltip {
  @apply bg-white text-gray-900 font-medium text-xs md:text-base px-3 py-2 rounded border-2 border-emerald-500 left-5 top-[-3rem];
}

.router-button {
  @apply rounded-lg border-amber-300 border-2 px-3 py-2 text-gray-900 font-semibold sm:text-base text-xs hover:bg-transparent w-full text-center;
}

.withdraw-button {
  opacity: v-bind(withdrawButtonOpacity);
  cursor: v-bind(withdrawButtonCursor);
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

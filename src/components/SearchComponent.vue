<script setup lang="ts">
import { ref, watch } from "vue";
import CustomButton from "@/components/CustomButton/CustomButton.vue";
import { debounce } from "@/utils/debounce";
import { useEtherStore } from "@/store/ether";
import { storeToRefs } from "pinia";
import { connectProvider } from "@/blockchain/provider";
import { verifyNetworkLiquidity } from "@/utils/networkLiquidity";
import { NetworkEnum } from "@/model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { decimalCount } from "@/utils/decimalCount";
import SpinnerComponent from "./SpinnerComponent.vue";

// Store reference
const etherStore = useEtherStore();

const {
  walletAddress,
  networkName,
  depositsValidListGoerli,
  depositsValidListMumbai,
  loadingNetworkLiquidity,
} = storeToRefs(etherStore);

// Reactive state
const tokenValue = ref<number>(0);
const enableConfirmButton = ref<boolean>(false);
const enableWalletButton = ref<boolean>(false);
const hasLiquidity = ref<boolean>(true);
const validDecimals = ref<boolean>(true);
const selectedGoerliDeposit = ref<ValidDeposit>();
const selectedMumbaiDeposit = ref<ValidDeposit>();
const selectedRootstockDeposit = ref<ValidDeposit>();

// Emits
const emit = defineEmits(["tokenBuy"]);

// Blockchain methods
const connectAccount = async (): Promise<void> => {
  await connectProvider();

  enableOrDisableConfirmButton();
};

const emitConfirmButton = (): void => {
  const selectedDeposit =
    networkName.value == NetworkEnum.ethereum
      ? selectedGoerliDeposit.value
      : selectedMumbaiDeposit.value;
  emit("tokenBuy", selectedDeposit, tokenValue.value);
};

// Debounce methods
const handleInputEvent = (event: any): void => {
  const { value } = event.target;

  tokenValue.value = Number(value);

  if (decimalCount(String(tokenValue.value)) > 2) {
    validDecimals.value = false;
    enableConfirmButton.value = false;
    return;
  }
  validDecimals.value = true;

  verifyLiquidity();
};

// Verify if there is a valid deposit to buy
const verifyLiquidity = (): void => {
  enableConfirmButton.value = false;
  selectedGoerliDeposit.value = undefined;
  selectedMumbaiDeposit.value = undefined;
  selectedRootstockDeposit.value = undefined;

  if (tokenValue.value <= 0) {
    enableWalletButton.value = false;
    return;
  }

  selectedGoerliDeposit.value = verifyNetworkLiquidity(
    tokenValue.value,
    walletAddress.value,
    depositsValidListGoerli.value
  );
  selectedMumbaiDeposit.value = verifyNetworkLiquidity(
    tokenValue.value,
    walletAddress.value,
    depositsValidListMumbai.value
  );

  enableOrDisableConfirmButton();
  if (selectedGoerliDeposit.value || selectedMumbaiDeposit.value) {
    hasLiquidity.value = true;
    enableWalletButton.value = true;
  } else {
    hasLiquidity.value = false;
    enableWalletButton.value = true;
  }
};

const enableOrDisableConfirmButton = (): void => {
  if (selectedGoerliDeposit.value && networkName.value == NetworkEnum.ethereum)
    enableConfirmButton.value = true;
  else if (
    selectedMumbaiDeposit.value &&
    networkName.value == NetworkEnum.polygon
  )
    enableConfirmButton.value = true;
  else enableConfirmButton.value = false;
};

watch(networkName, (): void => {
  verifyLiquidity();
  enableOrDisableConfirmButton();
});

watch(walletAddress, (): void => {
  verifyLiquidity();
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span
        class="text font-extrabold sm:text-5xl text-3xl sm:max-w-[29rem] max-w-[20rem]"
      >
        Adquira cripto com apenas um Pix</span
      >
      <span class="text font-medium sm:text-base text-sm max-w-[28rem]"
        >Digite um valor, confira a oferta, conecte sua carteira e receba os
        tokens após realizar o Pix</span
      >
    </div>
    <div class="blur-container">
      <div class="backdrop-blur -z-10 w-full h-full"></div>
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-5 rounded-lg border-y-10"
      >
        <div class="flex justify-between sm:w-full items-center">
          <input
            type="number"
            class="border-none outline-none text-lg text-gray-900 w-3/4"
            v-bind:class="{
              'font-semibold': tokenValue != undefined,
              'text-xl': tokenValue != undefined,
            }"
            @input="debounce(handleInputEvent, 500)($event)"
            placeholder="0  "
            step=".01"
          />
          <div
            class="flex flex-row p-2 px-3 bg-gray-300 rounded-3xl min-w-fit gap-1"
          >
            <img
              alt="Token image"
              class="sm:w-fit w-4"
              src="@/assets/brz.svg"
            />
            <span class="text-gray-900 sm:text-lg text-md w-fit" id="brz"
              >BRZ</span
            >
          </div>
        </div>

        <div class="custom-divide py-2 mb-2"></div>
        <div
          class="flex justify-between"
          v-if="hasLiquidity && !loadingNetworkLiquidity"
        >
          <p class="text-gray-500 font-normal text-sm w-auto">
            ~ R$ {{ tokenValue.toFixed(2) }}
          </p>
          <div class="flex gap-2">
            <img
              alt="Polygon image"
              src="@/assets/polygon.svg"
              width="24"
              height="24"
              v-if="selectedMumbaiDeposit"
            />
            <img
              alt="Ethereum image"
              src="@/assets/ethereum.svg"
              width="24"
              height="24"
              v-if="selectedGoerliDeposit"
            />
          </div>
        </div>
        <div
          class="flex justify-center items-center"
          v-if="loadingNetworkLiquidity"
        >
          <span class="text-gray-900 font-normal text-sm mr-2"
            >Carregando liquidez das redes.</span
          >
          <SpinnerComponent width="4" height="4"></SpinnerComponent>
        </div>
        <div
          class="flex justify-center"
          v-if="!validDecimals && !loadingNetworkLiquidity"
        >
          <span class="text-red-500 font-normal text-sm"
            >Por favor utilize no máximo 2 casas decimais</span
          >
        </div>
        <div
          class="flex justify-center"
          v-else-if="!hasLiquidity && !loadingNetworkLiquidity"
        >
          <span class="text-red-500 font-normal text-sm"
            >Atualmente não há liquidez nas redes para sua demanda</span
          >
        </div>
      </div>
      <CustomButton
        v-if="!walletAddress"
        :text="'Conectar carteira'"
        :is-disabled="!enableWalletButton"
        @buttonClicked="connectAccount()"
      />
      <CustomButton
        v-if="walletAddress"
        :text="'Confirmar compra'"
        :is-disabled="!enableConfirmButton"
        @buttonClicked="emitConfirmButton()"
      />
    </div>
  </div>
</template>

<style scoped>
.custom-divide {
  width: 100%;
  border-bottom: 1px solid #d1d5db;
}
.bottom-position {
  top: -20px;
  right: 50%;
  transform: translateX(50%);
}

.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.text {
  @apply text-white text-center;
}

.blur-container {
  @apply flex flex-col justify-center items-center px-8 py-6 gap-2 rounded-lg shadow-md shadow-gray-600 mt-10;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

<script setup lang="ts">
import { ref, watch } from "vue";
import { useUser } from "@/composables/useUser";
import SpinnerComponent from "@/components/SpinnerComponent.vue";
import CustomButton from "@/components/CustomButton/CustomButton.vue";
import { debounce } from "@/utils/debounce";
import { verifyNetworkLiquidity } from "@/utils/networkLiquidity";
import { NetworkEnum } from "@/model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { decimalCount } from "@/utils/decimalCount";
import { getTokenImage } from "@/utils/imagesPath";
import { onClickOutside } from "@vueuse/core";

import { TokenEnum } from "@/model/NetworkEnum";

// Store reference
const user = useUser();
const selectTokenToggle = ref<boolean>(false);

const {
  walletAddress,
  networkName,
  selectedToken,
  depositsValidList,
  loadingNetworkLiquidity,
} = user;

// html references
const tokenDropdownRef = ref<any>(null);

// Reactive state
const tokenValue = ref<number>(0);
const enableConfirmButton = ref<boolean>(false);
const hasLiquidity = ref<boolean>(true);
const validDecimals = ref<boolean>(true);
const identification = ref<string>("");
const selectedDeposits = ref<ValidDeposit[]>();

import ChevronDown from "@/assets/chevronDown.svg";
import { useOnboard } from "@web3-onboard/vue";
import { getParticipantID } from "@/blockchain/events";

// Emits
const emit = defineEmits(["tokenBuy"]);

// Blockchain methods
const connectAccount = async (): Promise<void> => {
  const { connectWallet } = useOnboard();
  await connectWallet();
};

const emitConfirmButton = async (): Promise<void> => {
  const deposit = selectedDeposits.value?.find(
    (d) => d.network === Number(networkName.value)
  );
  if (!deposit) return;
  deposit.participantID = await getParticipantID(deposit.seller, deposit.token);
  emit("tokenBuy", deposit, tokenValue.value);
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

const openTokenSelection = (): void => {
  selectTokenToggle.value = true;
};

onClickOutside(tokenDropdownRef, () => {
  selectTokenToggle.value = false;
});

const handleSelectedToken = (token: TokenEnum): void => {
  user.setSelectedToken(token);
  selectTokenToggle.value = false;
};

// Verify if there is a valid deposit to buy
const verifyLiquidity = (): void => {
  enableConfirmButton.value = false;
  if (!walletAddress.value)
    return;
  const selDeposits = verifyNetworkLiquidity(
    tokenValue.value,
    walletAddress.value,
    depositsValidList.value
  );
  selectedDeposits.value = selDeposits;
  hasLiquidity.value = !!selDeposits.find(
    (d) => d.network === Number(networkName.value)
  );
  enableOrDisableConfirmButton();
};

const enableOrDisableConfirmButton = (): void => {
  if (!selectedDeposits.value) {
    enableConfirmButton.value = false;
    return;
  }

  if (!selectedDeposits.value.find((d) => d.network === networkName.value)) {
    enableConfirmButton.value = false;
    return;
  }

  enableConfirmButton.value = true;
};

watch(networkName, (): void => {
  verifyLiquidity();
  enableOrDisableConfirmButton();
});

watch(walletAddress, (): void => {
  verifyLiquidity();
});

// Add form submission handler
const handleSubmit = async (e: Event): Promise<void> => {
  e.preventDefault();
  if (walletAddress.value) {
    await emitConfirmButton();
  } else {
    await connectAccount();
  }
};
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
    <form class="main-container" @submit="handleSubmit">
      <div class="backdrop-blur -z-10 w-full h-full"></div>
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-5 rounded-lg border-y-10"
      >
        <div class="flex justify-between sm:w-full items-center">
          <input
            type="number"
            name="tokenAmount"
            class="border-none outline-none text-lg text-gray-900"
            v-bind:class="{
              'font-semibold': tokenValue != undefined,
              'text-xl': tokenValue != undefined,
            }"
            @input="debounce(handleInputEvent, 500)($event)"
            placeholder="0"
            step=".01"
            required
          />
          <div class="relative overflow-visible">
            <button
              ref="tokenDropdownRef"
              class="flex flex-row items-center p-2 bg-gray-300 hover:bg-gray-200 focus:outline-indigo-800 focus:outline-2 rounded-3xl min-w-fit gap-2 transition-colors"
              @click="openTokenSelection()"
            >
              <img
                alt="Token image"
                class="sm:w-fit w-4"
                :src="getTokenImage(selectedToken)"
              />
              <span
                class="text-gray-900 sm:text-lg text-md font-medium"
                id="token"
                >{{ selectedToken }}</span
              >
              <ChevronDown
                class="pr-4 sm:pr-0 transition-all duration-500 ease-in-out invert"
                :class="{ 'scale-y-[-1]': selectTokenToggle }"
                alt="Chevron Down"
              />
            </button>
            <transition name="dropdown">
              <div
                v-if="selectTokenToggle"
                class="mt-2 text-gray-900 absolute right-0 z-50 w-full min-w-max"
              >
                <div
                  class="bg-white rounded-xl z-10 border border-gray-300 drop-shadow-md shadow-md overflow-clip"
                >
                  <div
                    v-for="token in TokenEnum"
                    :key="token"
                    class="flex menu-button gap-2 px-4 cursor-pointer hover:bg-gray-300 transition-colors"
                    @click="handleSelectedToken(token)"
                  >
                    <img
                      :alt="token + ' logo'"
                      width="20"
                      height="20"
                      :src="getTokenImage(token)"
                    />
                    <span
                      class="text-gray-900 py-4 text-end font-semibold text-sm"
                    >
                      {{ token }}
                    </span>
                  </div>
                  <div class="w-full flex justify-center">
                    <hr class="w-4/5" />
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
        <div class="custom-divide py-2 mb-2"></div>
        <div class="flex justify-between" v-if="!loadingNetworkLiquidity">
          <p class="text-gray-500 font-normal text-sm w-auto">
            ~ R$ {{ tokenValue.toFixed(2) }}
          </p>
          <div class="flex gap-2">
            <img
              alt="Rootstock image"
              src="@/assets/rootstock.svg?url"
              width="24"
              height="24"
              v-if="
                selectedDeposits &&
                selectedDeposits.find((d) => d.network == NetworkEnum.rootstock)
              "
            />
            <img
              alt="Ethereum image"
              src="@/assets/ethereum.svg?url"
              width="24"
              height="24"
              v-if="
                selectedDeposits &&
                selectedDeposits.find((d) => d.network == NetworkEnum.sepolia)
              "
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
          v-else-if="
            !hasLiquidity && !loadingNetworkLiquidity && tokenValue > 0
          "
        >
          <span class="text-red-500 font-normal text-sm"
            >Atualmente não há liquidez nas rede selecionada para sua
            demanda</span
          >
        </div>
      </div>

      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg border-y-10"
      >
        <input
          type="text"
          v-model="identification"
          maxlength="14"
          :pattern="'^\\d{11}$|^\\d{14}$'"
          class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
          placeholder="Digite seu CPF ou CNPJ (somente números)"
          required
        />
      </div>

      <!-- Action buttons -->
      <CustomButton
        v-if="walletAddress"
        type="submit"
        text="Confirmar Oferta"
      />
      <CustomButton
        v-else
        text="Conectar carteira"
        @buttonClicked="connectAccount()"
      />
    </form>
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

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

.custom-button {
  @apply w-full py-3 px-6 rounded-lg font-semibold text-white bg-indigo-600 
         hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed
         transition-colors duration-200;
}
</style>

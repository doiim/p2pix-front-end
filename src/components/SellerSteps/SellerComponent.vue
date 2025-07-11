<script setup lang="ts">
import { ref, computed } from "vue";
import { useUser } from "@/composables/useUser";
import CustomButton from "@/components/CustomButton/CustomButton.vue";
import { postProcessKey } from "@/utils/pixKeyFormat";
import { TokenEnum } from "@/model/NetworkEnum";
import { getTokenImage } from "@/utils/imagesPath";
import { useOnboard } from "@web3-onboard/vue";
import ChevronDown from "@/assets/chevron.svg";

// Import the bank list
import bankList from "@/utils/files/isbpList.json";
import type { Participant } from "@/utils/bbPay";

// Define Bank interface
interface Bank {
  ISPB: string;
  longName: string;
}

// html references
const tokenDropdownRef = ref<any>(null);
const formRef = ref<HTMLFormElement | null>(null);

// Reactive state
const user = useUser();
const { walletAddress, selectedToken } = user;

const offer = ref<string>("");
const identification = ref<string>("");
const account = ref<string>("");
const branch = ref<string>("");
const accountType = ref<string>("");
const selectTokenToggle = ref<boolean>(false);
const savingsVariation = ref<string>("");
const errors = ref<{ [key: string]: string }>({});

// Bank selection
const bankSearchQuery = ref<string>("");
const showBankList = ref<boolean>(false);
const selectedBank = ref<Bank | null>(null);

const filteredBanks = computed(() => {
  if (!bankSearchQuery.value) return [];
  return bankList
    .filter((bank) =>
      bank.longName.toLowerCase().includes(bankSearchQuery.value.toLowerCase())
    )
    .slice(0, 5);
});

const handleBankSelect = (bank: Bank) => {
  selectedBank.value = bank;
  bankSearchQuery.value = bank.longName;
  showBankList.value = false;
};

// Emits
const emit = defineEmits(["approveTokens"]);

// Methods
const connectAccount = async (): Promise<void> => {
  const { connectWallet } = useOnboard();
  await connectWallet();
};

const handleSubmit = (e: Event): void => {
  e.preventDefault();

  const processedIdentification = postProcessKey(identification.value);

  const data: Participant = {
    offer: offer.value,
    chainID: user.networkId.value,
    identification: processedIdentification,
    bankIspb: selectedBank.value?.ISPB,
    accountType: accountType.value,
    account: account.value,
    branch: branch.value,
    savingsVariation: savingsVariation.value || "",
  };

  emit("approveTokens", data);
};

// Token selection
const openTokenSelection = (): void => {
  selectTokenToggle.value = true;
};

const handleSelectedToken = (token: TokenEnum): void => {
  user.setSelectedToken(token);
  selectTokenToggle.value = false;
};
</script>

<template>
  <div class="page w-full">
    <div class="text-container">
      <span
        class="text font-extrabold sm:text-5xl text-3xl sm:max-w-[29rem] max-w-[20rem]"
      >
        Venda cripto e receba em Pix
      </span>
      <span
        class="text font-medium sm:text-base text-xs sm:max-w-[28rem] max-w-[30rem] sm:tracking-normal tracking-wide"
      >
        Digite sua oferta, informe a chave Pix, selecione a rede, aprove o envio
        da transação e confirme sua oferta.
      </span>
    </div>

    <form ref="formRef" @submit="handleSubmit" class="main-container">
      <!-- Offer input -->
      <div
        class="flex justify-between items-center w-full bg-white sm:px-10 px-6 py-5 rounded-lg border-y-10 gap-4"
      >
        <input
          type="number"
          v-model="offer"
          class="border-none outline-none text-gray-900 sm:w-fit w-3/4 flex-grow"
          :class="{
            '!font-medium': offer !== undefined && offer !== '',
            'text-xl': offer !== undefined && offer !== '',
          }"
          min="0.01"
          max="999999999.99"
          pattern="\d+(\.\d{0,2})?"
          placeholder="Digite sua oferta (mínimo R$0,01)"
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
            >
              {{ selectedToken }}
            </span>
            <ChevronDown
              class="text-gray-900 pr-4 sm:pr-0 transition-all duration-500 ease-in-out"
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
              </div>
            </div>
          </transition>
        </div>
      </div>
      <!-- CPF or CNPJ input -->
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg border-y-10"
      >
        <input
          type="text"
          v-model="identification"
          maxlength="14"
          :pattern="'^\\d{11}$|^\\d{14}$'"
          class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
          :class="{ 'text-xl font-medium': identification }"
          placeholder="Digite seu CPF ou CNPJ (somente números)"
          required
        />
      </div>
      <!-- Bank selection -->
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg border-y-10"
      >
        <div class="relative">
          <input
            type="text"
            v-model="bankSearchQuery"
            class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
            :class="{ 'text-xl font-medium': bankSearchQuery }"
            placeholder="Buscar banco"
            @focus="showBankList = true"
            required
          />
          <div
            v-if="showBankList && filteredBanks.length > 0"
            class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-60 overflow-y-auto"
          >
            <div
              v-for="bank in filteredBanks"
              :key="bank.ISPB"
              class="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors"
              @click="handleBankSelect(bank)"
            >
              <div class="text-sm font-medium text-gray-900">
                {{ bank.longName }}
              </div>
              <div class="text-xs text-gray-500">ISPB: {{ bank.ISPB }}</div>
            </div>
          </div>
        </div>
        <span v-if="errors.bank" class="text-red-500 text-sm mt-2">{{
          errors.bank
        }}</span>
      </div>
      <!-- Account and Branch inputs -->
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg border-y-10"
      >
        <div class="flex gap-4">
          <div class="flex-1">
            <input
              type="text"
              v-model="account"
              class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
              :class="{ 'text-xl font-medium': account }"
              placeholder="Número da conta"
              required
            />
          </div>
          <div class="flex-1">
            <input
              type="text"
              v-model="branch"
              class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
              :class="{ 'text-xl font-medium': branch }"
              placeholder="Agência"
              required
            />
          </div>
        </div>
      </div>
      <!-- Account Type Selection -->
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg border-y-10"
      >
        <div class="flex gap-4">
          <div class="flex-1">
            <select
              v-model="accountType"
              class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
              required
            >
              <option value="" disabled selected>Tipo de conta</option>
              <option value="1">Conta Corrente</option>
              <option value="2">Conta Poupança</option>
              <option value="3">Conta Salário</option>
              <option value="4">Conta Pré-Paga</option>
            </select>
          </div>
        </div>
      </div>
      <!-- Savings Account Variation -->
      <Transition name="resize">
        <input
          v-if="accountType === '2'"
          type="text"
          v-model="savingsVariation"
          class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full bg-white sm:px-10 px-6 py-4 rounded-lg border-y-10"
          :class="{ 'text-xl font-medium': savingsVariation }"
          placeholder="Variação da poupança"
          required
        />
      </Transition>
      <!-- Action buttons -->
      <CustomButton v-if="walletAddress" type="submit" text="Aprovar tokens" />
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
  appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

input {
  @apply sm:text-lg text-sm;
}
</style>

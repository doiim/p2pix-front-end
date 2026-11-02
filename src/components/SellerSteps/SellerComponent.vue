<script setup lang="ts">
import { ref, computed } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import CustomButton from '@/components/ui/CustomButton.vue';
import { postProcessKey } from '@/utils/pixKeyFormat';
import { TokenEnum } from '@/model/NetworkEnum';
import { getTokenImage } from '@/utils/imagesPath';
import { floorCents, formatBrlFixed } from '@/utils/reputation';
import { useConnectModal } from '@/wallet/useConnectModal';
import ChevronDown from '@/assets/chevron.svg';

// Import the bank list
import bankList from '@/utils/files/isbpList.json';
import type { Participant } from '@/utils/bbPay';

// Define Bank interface
interface Bank {
  COMPE: string;
  ISPB: string;
  longName: string;
}

// html references
const tokenDropdownRef = ref<HTMLElement | null>(null);
const bankFieldRef = ref<HTMLElement | null>(null);
const formRef = ref<HTMLFormElement | null>(null);

// Reactive state
const user = useUser();
const { selectedToken } = user;
const walletAddress = useWalletAddress();

const offer = ref<string>('');
const identification = ref<string>('');
const account = ref<string>('');
const branch = ref<string>('');
const accountType = ref<string>('');
const selectTokenToggle = ref<boolean>(false);
const savingsVariation = ref<string>('');
const errors = ref<{ [key: string]: string }>({});

// Bank selection
const bankSearchQuery = ref<string>('');
const showBankList = ref<boolean>(false);
const selectedBank = ref<Bank | null>(null);
const activeBankIndex = ref<number>(0);

// Case- and accent-insensitive, so "amazonia" finds "Amazônia"
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const filteredBanks = computed<Bank[]>(() => {
  const query = normalize(bankSearchQuery.value.trim());
  if (!query) return [];
  return bankList
    .filter(
      (bank) =>
        normalize(bank.longName).includes(query) ||
        bank.COMPE.startsWith(query) ||
        bank.ISPB.startsWith(query),
    )
    .slice(0, 6);
});

const bankListOpen = computed(
  () => showBankList.value && bankSearchQuery.value.trim() !== '',
);

const handleBankInput = (): void => {
  // Editing the name drops the bank picked before, so a stale ISPB is never sent
  selectedBank.value = null;
  activeBankIndex.value = 0;
  showBankList.value = true;
};

const handleBankSelect = (bank: Bank) => {
  selectedBank.value = bank;
  bankSearchQuery.value = bank.longName;
  showBankList.value = false;
  delete errors.value.bank;
};

const moveActiveBank = (step: number): void => {
  const count = filteredBanks.value.length;
  if (!count) return;
  showBankList.value = true;
  activeBankIndex.value = (activeBankIndex.value + step + count) % count;
};

const bankKeyActions: Record<string, () => void> = {
  ArrowDown: () => moveActiveBank(1),
  ArrowUp: () => moveActiveBank(-1),
  Enter: () => {
    const bank = filteredBanks.value[activeBankIndex.value];
    if (bank) handleBankSelect(bank);
  },
  Escape: () => (showBankList.value = false),
};

const handleBankKeydown = (e: KeyboardEvent): void => {
  const action = bankKeyActions[e.key];
  if (!action || !bankListOpen.value) return;
  e.preventDefault();
  action();
};

onClickOutside(bankFieldRef, () => {
  showBankList.value = false;
});

// Emits
const emit = defineEmits(['approveTokens']);

const { open: connectAccount } = useConnectModal();

const handleSubmit = (e: Event): void => {
  e.preventDefault();

  if (!selectedBank.value) {
    errors.value.bank = 'Selecione o banco na lista';
    return;
  }

  const processedIdentification = postProcessKey(identification.value);

  const data: Participant = {
    offer: offer.value,
    chainID: user.network.value.id,
    identification: processedIdentification,
    bankIspb: selectedBank.value.ISPB,
    accountType: accountType.value,
    account: account.value,
    branch: branch.value,
    savingsVariation: savingsVariation.value || '',
  };

  emit('approveTokens', data);
};

// Token selection
const toggleTokenSelection = (): void => {
  selectTokenToggle.value = !selectTokenToggle.value;
};

onClickOutside(tokenDropdownRef, () => {
  selectTokenToggle.value = false;
});

const handleSelectedToken = (token: TokenEnum): void => {
  user.setSelectedToken(token);
  selectTokenToggle.value = false;
};
</script>

<template>
  <form ref="formRef" @submit="handleSubmit" class="main-container">
    <slot />
    <!-- Offer input -->
    <div class="flex flex-col w-full bg-white sm:px-10 px-6 py-5 rounded-lg">
      <div class="flex justify-between items-center gap-4">
        <input
          type="number"
          v-model="offer"
          class="border-none outline-none text-lg text-gray-900 sm:w-fit w-3/4 flex-grow"
          :class="{
            '!font-medium': offer !== undefined && offer !== '',
            'text-xl': offer !== undefined && offer !== '',
          }"
          min="0.01"
          max="999999999.99"
          pattern="\d+(\.\d{0,2})?"
          placeholder="0"
          step=".01"
          required
        />
        <div ref="tokenDropdownRef" class="relative overflow-visible shrink-0">
          <button
            type="button"
            class="flex flex-row items-center p-2 bg-gray-300 hover:bg-gray-200 focus:outline-indigo-800 focus:outline-2 rounded-3xl min-w-fit gap-2 transition-colors"
            :aria-expanded="selectTokenToggle"
            @click="toggleTokenSelection()"
          >
            <img
              alt="Imagem do token"
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
              class="shrink-0 text-gray-900 transition-all duration-500 ease-in-out"
              :class="{ 'scale-y-[-1]': selectTokenToggle }"
              alt="Expandir"
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
      <div class="custom-divide py-2 mb-2"></div>
      <p class="text-gray-500 font-normal text-sm">
        ~ R$ {{ formatBrlFixed(floorCents(Number(offer))) }}
      </p>
    </div>
    <!-- CPF or CNPJ input -->
    <div class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg">
      <input
        type="text"
        v-model="identification"
        maxlength="14"
        :pattern="'^\\d{11}$|^\\d{14}$'"
        class="border-none outline-none text-sm text-gray-900 w-full"
        :class="{ 'text-xl font-medium': identification }"
        placeholder="CPF ou CNPJ (somente números)"
        required
      />
    </div>
    <!-- Bank selection -->
    <div
      ref="bankFieldRef"
      class="relative flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg"
    >
      <input
        type="text"
        v-model="bankSearchQuery"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="bank-options"
        :aria-expanded="bankListOpen"
        :aria-activedescendant="
          bankListOpen && filteredBanks.length
            ? `bank-option-${activeBankIndex}`
            : undefined
        "
        :aria-invalid="!!errors.bank"
        autocomplete="off"
        class="border-none outline-none text-sm text-gray-900 w-full"
        :class="{ 'text-xl font-medium': bankSearchQuery }"
        placeholder="Buscar banco (nome, código ou ISPB)"
        @focus="showBankList = true"
        @input="handleBankInput"
        @keydown="handleBankKeydown"
        required
      />
      <span v-if="errors.bank" class="text-red-500 text-sm mt-2">{{
        errors.bank
      }}</span>
      <transition name="dropdown">
        <ul
          v-if="bankListOpen"
          id="bank-options"
          role="listbox"
          class="absolute top-full inset-x-0 mt-2 z-50 max-h-72 overflow-y-auto bg-white rounded-xl border border-gray-300 shadow-md py-1"
        >
          <li
            v-for="(bank, index) in filteredBanks"
            :id="`bank-option-${index}`"
            :key="bank.ISPB"
            role="option"
            :aria-selected="index === activeBankIndex"
            class="flex items-center gap-3 sm:px-10 px-6 py-3 cursor-pointer transition-colors"
            :class="{ 'bg-gray-100': index === activeBankIndex }"
            @mouseenter="activeBankIndex = index"
            @click="handleBankSelect(bank)"
          >
            <span
              class="shrink-0 w-11 text-center rounded-md border border-gray-300 py-0.5 text-xs font-semibold text-gray-500 tabular-nums"
              >{{ bank.COMPE }}</span
            >
            <span class="flex flex-col">
              <span class="text-sm font-medium text-gray-900 leading-snug">{{
                bank.longName
              }}</span>
              <span class="text-xs text-gray-500 tabular-nums"
                >ISPB {{ bank.ISPB }}</span
              >
            </span>
          </li>
          <li
            v-if="!filteredBanks.length"
            class="sm:px-10 px-6 py-3 text-sm text-gray-500"
          >
            Nenhum banco encontrado
          </li>
        </ul>
      </transition>
    </div>
    <!-- Account and Branch inputs -->
    <div class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg">
      <div class="flex gap-4">
        <div class="flex-1">
          <input
            type="text"
            v-model="account"
            class="border-none outline-none text-sm text-gray-900 w-full"
            :class="{ 'text-xl font-medium': account }"
            placeholder="Número da conta"
            required
          />
        </div>
        <div class="flex-1">
          <input
            type="text"
            v-model="branch"
            class="border-none outline-none text-sm text-gray-900 w-full"
            :class="{ 'text-xl font-medium': branch }"
            placeholder="Agência"
            required
          />
        </div>
      </div>
    </div>
    <!-- Account Type Selection -->
    <div class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg">
      <div class="flex gap-4">
        <div class="flex-1">
          <select
            v-model="accountType"
            class="border-none outline-none text-sm text-gray-900 w-full"
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
        class="border-none outline-none text-sm text-gray-900 w-full bg-white sm:px-10 px-6 py-4 rounded-lg"
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
    <slot name="footer" />
  </form>
</template>

<style scoped>
@reference "tailwindcss";
.custom-divide {
  width: 100%;
  border-bottom: 1px solid #d1d5db;
}
.bottom-position {
  top: -20px;
  right: 50%;
  transform: translateX(50%);
}

input[type='number'] {
  -moz-appearance: textfield;
  appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

input {
  @apply text-sm;
}
</style>

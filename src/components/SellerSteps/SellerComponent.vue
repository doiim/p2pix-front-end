<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { formatUnits, isHex, parseEther, zeroAddress, zeroHash } from 'viem';
import { useRouter } from 'vue-router';
import { readAllowlistRoot } from '@/blockchain/allowlist';
import { entryLabel, readOwnAllowlist } from '@/utils/allowlistStorage';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import CustomButton from '@/components/ui/CustomButton.vue';
import TokenSelector from '@/components/Swap/TokenSelector.vue';
import { postProcessKey } from '@/utils/pixKeyFormat';
import { floorCents, formatBrlFixed } from '@/utils/reputation';
import { useConnectModal } from '@/wallet/useConnectModal';
import { defaultUiToken, findSwapToken } from '@/model/BuyToken';
import { IMPACT_WARN_BPS, quoteBrzCost } from '@/blockchain/swap';
import { useSwapQuote } from '@/composables/useSwapQuote';

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
const savingsVariation = ref<string>('');
const errors = ref<{ [key: string]: string }>({});

// Pay with: BRZ deposits as is; a swap token first buys the offer's BRZ on CoW.
const payToken = ref<string>(defaultUiToken(user.network.value));
const swapToken = computed(() =>
  findSwapToken(user.network.value, payToken.value),
);
const cost = useSwapQuote<{
  cost: bigint;
  decimals: number;
  impactBps: number;
}>();
const costLabel = computed(() =>
  cost.result.value
    ? Number(
        formatUnits(cost.result.value.cost, cost.result.value.decimals),
      ).toFixed(2)
    : null,
);

let quoteTimer: ReturnType<typeof setTimeout> | undefined;
const refreshCost = (): void => {
  clearTimeout(quoteTimer);
  quoteTimer = setTimeout(() => {
    const token = swapToken.value;
    cost.run(
      token && Number(offer.value) > 0
        ? () =>
            quoteBrzCost(
              token.symbol,
              parseEther(String(offer.value)),
              walletAddress.value ?? zeroAddress,
            )
        : null,
    );
  }, 500);
};
watch([offer, payToken], refreshCost);
watch(user.network, () => {
  // Swap tokens exist only on chains with a CoW config.
  if (!swapToken.value) payToken.value = defaultUiToken(user.network.value);
});

// Trusted buyers: read-only summary of the on-chain allowlist root.
const router = useRouter();
const allowlistRoot = ref<string | null>(null);
watch(
  [walletAddress, () => user.network.value.id],
  async ([seller]) => {
    allowlistRoot.value = null;
    if (!seller) return;
    const root = await readAllowlistRoot(seller).catch(() => null);
    // Ignore a result that arrives after the seller or network changed.
    if (seller === walletAddress.value && isHex(root)) {
      allowlistRoot.value = root;
    }
  },
  { immediate: true },
);
const allowlistActive = computed(
  () => allowlistRoot.value !== null && allowlistRoot.value !== zeroHash,
);
const allowlistSubLabel = computed(() => {
  if (!allowlistActive.value) return 'Comprar sem o limite de reputação';
  const entries = walletAddress.value
    ? readOwnAllowlist(user.network.value.id, walletAddress.value)
    : [];
  if (!entries.length) return 'Lista ativa na rede';
  const names = entries.slice(0, 2).map(entryLabel);
  const rest = entries.length - names.length;
  if (rest > 0) names.push(`mais ${rest}`);
  return new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(names);
});
const editAllowlist = (): void => void router.push('/allowlist');

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

  emit('approveTokens', data, swapToken.value?.symbol);
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
        <TokenSelector v-model="payToken" />
      </div>
      <div class="custom-divide py-2 mb-2"></div>
      <p class="text-gray-500 font-normal text-sm">
        ~ R$ {{ formatBrlFixed(floorCents(Number(offer))) }}
      </p>
    </div>
    <div
      v-if="swapToken"
      class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg gap-1 text-sm text-center"
    >
      <span class="text-gray-500"
        >Você paga ~
        {{ cost.quoting.value ? 'cotando…' : (costLabel ?? '—') }}
        {{ payToken }}. A CoW Swap troca por {{ offer || 0 }}
        {{ selectedToken }} antes do depósito; se a ordem não executar, o
        {{ payToken }} fica na sua carteira.</span
      >
      <span
        v-if="
          cost.result.value && cost.result.value.impactBps > IMPACT_WARN_BPS
        "
        class="text-amber-600"
        >Impacto de preço de
        {{ (cost.result.value.impactBps / 100).toFixed(1) }}% pela liquidez
        disponível agora.</span
      >
      <span v-if="cost.failed.value" class="text-red-500"
        >Sem cotação para {{ payToken }} agora. Tente outro valor ou escolha
        {{ selectedToken }}.</span
      >
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
    <!-- Trusted buyers -->
    <div
      v-if="walletAddress && allowlistRoot !== null"
      class="flex items-center justify-between gap-4 w-full bg-white sm:px-10 px-6 py-4 rounded-lg"
    >
      <div class="flex flex-col min-w-0">
        <span class="text-sm font-medium text-gray-900"
          >Compradores confiáveis</span
        >
        <span class="text-xs text-gray-500 truncate">{{
          allowlistSubLabel
        }}</span>
        <span id="allowlist-switch-help" class="sr-only"
          >Para editar, abra a página Compradores confiáveis.</span
        >
      </div>
      <div class="flex items-center gap-3 shrink-0">
        <button
          type="button"
          class="text-xs underline text-gray-500"
          @click="editAllowlist"
        >
          Editar
        </button>
        <button
          type="button"
          role="switch"
          :aria-checked="allowlistActive"
          aria-label="Compradores confiáveis"
          aria-describedby="allowlist-switch-help"
          class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
          :class="allowlistActive ? 'bg-emerald-500' : 'bg-gray-300'"
          @click="editAllowlist"
        >
          <span
            class="inline-block h-5 w-5 rounded-full bg-white transition-transform"
            :class="allowlistActive ? 'translate-x-5' : 'translate-x-0.5'"
          />
        </button>
      </div>
    </div>
    <!-- Action buttons -->
    <CustomButton
      v-if="walletAddress"
      type="submit"
      :text="
        swapToken
          ? `Trocar ${payToken} por ${selectedToken}`
          : 'Enviar para a rede'
      "
      :isDisabled="!!swapToken && (cost.quoting.value || !cost.result.value)"
    />
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

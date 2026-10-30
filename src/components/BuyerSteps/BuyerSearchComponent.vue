<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { useUser } from '@/composables/useUser';
import { useReputation } from '@/composables/useReputation';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import CustomButton from '@/components/ui/CustomButton.vue';
import ReputationChecking from '@/components/BuyerSteps/Reputation/ReputationChecking.vue';
import ReputationDetailsPanel from '@/components/BuyerSteps/Reputation/ReputationDetailsPanel.vue';
import ReputationLimitRow from '@/components/BuyerSteps/Reputation/ReputationLimitRow.vue';
import ReputationMaxButton from '@/components/BuyerSteps/Reputation/ReputationMaxButton.vue';
import ChevronDown from '@/assets/chevronDown.svg';
import { verifyNetworkLiquidity } from '@/utils/networkLiquidity';
import { getTokenImage, getNetworkImage } from '@/utils/imagesPath';
import {
  LIMIT_ROW_SENTENCES,
  amountInputText,
  classifyAmount,
  floorCents,
  formatBrl,
  formatBrlFixed,
  formatTokens,
  limitRowVariant,
  parseAmountInput,
} from '@/utils/reputation';
import type { BuyPress, LimitRowVariant, PanelTag } from '@/utils/reputation';
import type { ValidDeposit } from '@/model/ValidDeposit';
import { Networks } from '@/config/networks';
import { useConnectModal } from '@/wallet/useConnectModal';
import { TokenEnum } from '@/model/NetworkEnum';
import { getCurrentAccount } from '@/blockchain/provider';
import { getAaOwnerKind, isAaAvailable } from '@/blockchain/aa/aaContext';
import { findAllowlistProof } from '@/blockchain/allowlist';

// Set by HomeView when the contract refused the lock with AmountNotAllowed: the press it refused,
// read once to seed the form.
const props = defineProps<{ refusal: BuyPress | null }>();

const emit = defineEmits<{
  tokenBuy: [deposit: ValidDeposit, press: BuyPress];
}>();

// Store reference
const user = useUser();
const reputation = useReputation();

const {
  walletAddress,
  network,
  selectedToken,
  depositsValidList,
  loadingNetworkLiquidity,
  failedLiquidityNetworks,
} = user;

// A network whose read failed has unknown liquidity, not zero liquidity.
const selectedNetworkUnread = computed(() =>
  failedLiquidityNetworks.value.some((n) => n.id === network.value.id),
);

// html references
const tokenDropdownEl = useTemplateRef<HTMLDivElement>('tokenDropdown');
const amountInputEl = useTemplateRef<HTMLInputElement>('amountInput');
const maxButtonEl =
  useTemplateRef<InstanceType<typeof ReputationMaxButton>>('maxButton');
const limitRowEl =
  useTemplateRef<InstanceType<typeof ReputationLimitRow>>('limitRow');

// Reactive state (seeded before any watcher exists, so a refusal does not clear itself)
const selectTokenToggle = ref<boolean>(false);
const amountText = ref(
  props.refusal ? amountInputText(floorCents(props.refusal.amount)) : '',
);
const open = ref(props.refusal !== null);
const tag = ref<PanelTag | null>(null);
const busy = ref(false);
const refused = ref(props.refusal !== null);
const announcement = ref('');

// Amount
const parsed = computed(() => parseAmountInput(amountText.value));
const tokenValue = computed(() =>
  parsed.value.status === 'ok' ? parsed.value.value : 0,
);
const validDecimals = computed(() => parsed.value.status !== 'tooManyDecimals');
const displayCents = computed(() => {
  if (parsed.value.status === 'ok') return parsed.value.cents;
  return parsed.value.status === 'tooManyDecimals'
    ? parsed.value.displayCents
    : 0n;
});

// Offers from other sellers. Lowercase both sides: the subgraph returns lowercase, the wallet checksummed.
const othersDeposits = computed(() => {
  const account = walletAddress.value?.toLowerCase();
  return depositsValidList.value.filter(
    (d) => d.seller.toLowerCase() !== account,
  );
});
const selectedDeposits = computed(() =>
  walletAddress.value
    ? verifyNetworkLiquidity(tokenValue.value, othersDeposits.value)
    : [],
);
const selectedDeposit = computed(() =>
  selectedDeposits.value.find((d) => d.network.id === network.value.id),
);
const hasLiquidity = computed(
  () => !walletAddress.value || selectedDeposit.value !== undefined,
);
const availableNetworks = computed(() =>
  Networks.filter((n) =>
    selectedDeposits.value.some((d) => d.network.id === n.id),
  ),
);
// Largest offer on this network from another seller: what one purchase can reach (Máx, panel P4).
const maxOfferCents = computed(() => {
  const cents = floorCents(
    Math.max(
      0,
      ...othersDeposits.value
        .filter((d) => d.network.id === network.value.id)
        .map((d) => d.remaining),
    ),
  );
  return cents === 0n ? null : cents;
});

// On the seller's on-chain allowlist the limit does not apply: `lock` sends the proof. `null` while the
// check runs, which gives no verdict, like a reputation read in flight.
const allowlisted = ref<boolean | null>(false);
watch(
  () => [selectedDeposit.value?.seller, walletAddress.value] as const,
  async ([seller, buyer], _, onCleanup) => {
    let stale = false;
    onCleanup(() => {
      stale = true;
    });
    allowlisted.value = seller && buyer ? null : false;
    if (!seller || !buyer) return;
    const proof = await findAllowlistProof(seller, buyer);
    if (!stale) allowlisted.value = proof.length > 0;
  },
  { immediate: true },
);

// Reputation: no snapshot (guest, loading, failed read) or an allowlist pass means no verdict, so nothing
// renders or blocks.
const verdict = computed(() =>
  reputation.snapshot.value !== null &&
  parsed.value.status === 'ok' &&
  allowlisted.value === false
    ? classifyAmount(parsed.value.wei, reputation.snapshot.value.limitTokens)
    : null,
);
const rowVariant = computed(() =>
  limitRowVariant(verdict.value, refused.value),
);
// The red row, Máx and the red input render together, never while liquidity loads.
const limitState = computed(() =>
  rowVariant.value !== null &&
  reputation.snapshot.value !== null &&
  !loadingNetworkLiquidity.value
    ? { variant: rowVariant.value, snapshot: reputation.snapshot.value }
    : null,
);
const showChecking = computed(
  () =>
    open.value &&
    reputation.snapshot.value === null &&
    reputation.reading.value,
);
// The panel is open only over the limit, so while it re-reads the input keeps its red (spec §4).
const amountInvalid = computed(
  () => limitState.value !== null || showChecking.value,
);
// Same check as usePasskeyAccount.isReady; reading walletAddress keeps it reactive to connector switches.
const accountKind = computed(() =>
  walletAddress.value !== null &&
  isAaAvailable(network.value) &&
  getAaOwnerKind(getCurrentAccount().connector?.id) !== null
    ? 'smartAccount'
    : 'wallet',
);

// No reputation term: the contract enforces the limit, and an over-limit press re-reads instead.
const enableConfirmButton = computed(
  () =>
    walletAddress.value !== null &&
    parsed.value.status === 'ok' &&
    hasLiquidity.value,
);

// A refusal belongs to the network and account it happened on, but must survive mount: only a real
// change drops it. On the immediate run Vue passes `[]` as the previous value of a multi-source watch.
watch(
  [() => network.value.id, walletAddress],
  (_, previous) => {
    tag.value = null;
    void reputation.ensure();
    if (previous.length > 0) refused.value = false;
  },
  { immediate: true },
);

watch(amountText, () => {
  refused.value = false;
});

// Closes once nothing is over and no read is pending. Registered after the ensure watcher, so the read
// it starts keeps a refusal's panel open (as the "Verificando seu limite…" skeleton) until it lands.
watch(
  [rowVariant, () => reputation.reading.value],
  ([variant, reading]) => {
    if (variant !== null || reading) return;
    open.value = false;
    tag.value = null;
  },
  { immediate: true },
);

// After a refusal, focus Máx and announce R3 when that row shows: at mount, since HomeView re-reads the
// limit before returning here, or later if that read failed and a retried one lands.
watch(
  () => limitState.value?.variant === 'refused',
  async (shown) => {
    const state = limitState.value;
    if (!shown || state === null) return;
    await nextTick();
    maxButtonEl.value?.focus();
    announceRow(state.variant, state.snapshot.limitTokens);
  },
  { immediate: true },
);

const { open: connectAccount } = useConnectModal();

const emitConfirmButton = (checkedWithin: boolean): void => {
  const deposit = selectedDeposit.value;
  if (!deposit) return;
  const press = {
    amount: tokenValue.value,
    checkedWithin,
  };
  emit('tokenBuy', deposit, press);
};

const toggleTokenSelection = (): void => {
  selectTokenToggle.value = !selectTokenToggle.value;
};

onClickOutside(tokenDropdownEl, () => {
  selectTokenToggle.value = false;
});

const handleSelectedToken = (token: TokenEnum): void => {
  user.setSelectedToken(token);
  selectTokenToggle.value = false;
};

const onToggle = (): void => {
  open.value = !open.value;
  tag.value = null;
};

const onFill = (cents: bigint): void => {
  amountText.value = amountInputText(cents);
  open.value = false;
  tag.value = null;
  refused.value = false;
  amountInputEl.value?.focus();
  announce(`Valor ajustado para R$ ${formatBrl(cents)}.`);
};

const onPanelClose = (): void => {
  open.value = false;
  limitRowEl.value?.focusToggle();
};

// Over the limit, the press re-reads the chain before blocking; only a fresh over-limit read blocks.
const handleSubmit = async (e: Event): Promise<void> => {
  e.preventDefault();
  if (!walletAddress.value) return connectAccount();
  if (busy.value) return;
  if (rowVariant.value === null) {
    refused.value = false;
    return emitConfirmButton(verdict.value === 'within');
  }

  const pressed = pressContext();
  busy.value = true;
  const read = await reputation.refresh({ timeoutMs: 4000 });
  busy.value = false;
  // Amount, network or account changed while reading: neither proceed nor block.
  if (pressContext() !== pressed || (!read.ok && read.reason === 'stale'))
    return;

  refused.value = false;
  const variant =
    read.ok && parsed.value.status === 'ok'
      ? limitRowVariant(
          classifyAmount(parsed.value.wei, read.snapshot.limitTokens),
          false,
        )
      : null;
  // Within now, or the read failed or timed out: the contract decides.
  if (!read.ok || variant === null) return emitConfirmButton(read.ok);

  open.value = true;
  tag.value = null;
  await nextTick();
  maxButtonEl.value?.focus();
  announceRow(variant, read.snapshot.limitTokens);
};

const pressContext = () =>
  `${network.value.id}:${walletAddress.value}:${amountText.value}`;

// Cleared first so a repeated sentence is announced again; only set on transitions, never per keystroke.
const announce = (text: string): void => {
  announcement.value = '';
  void nextTick(() => {
    announcement.value = text;
  });
};

// The limit row's own words, for a row that appears with focus elsewhere (on Máx).
const announceRow = (variant: LimitRowVariant, limitTokens: bigint): void =>
  announce(`${LIMIT_ROW_SENTENCES[variant]} R$ ${formatTokens(limitTokens)}.`);
</script>

<template>
  <form class="main-container" @submit="handleSubmit">
    <slot />
    <div class="flex flex-col w-full bg-white sm:px-10 px-6 py-5 rounded-lg">
      <div class="flex justify-between sm:w-full items-center gap-3 sm:gap-4">
        <input
          ref="amountInput"
          v-model="amountText"
          type="text"
          inputmode="decimal"
          name="tokenAmount"
          placeholder="0"
          required
          :aria-label="`Quantidade de ${selectedToken}`"
          :aria-invalid="amountInvalid ? 'true' : 'false'"
          :aria-describedby="limitState ? 'rep-status rep-amount' : undefined"
          class="flex-1 min-w-0 max-w-[60%] p-0 border-0 outline-none bg-transparent text-xl font-semibold placeholder:text-gray-900/50"
          :class="amountInvalid ? 'text-red-700' : 'text-gray-900'"
        />
        <div class="flex items-center flex-none gap-1 sm:gap-2 ml-auto sm:ml-0">
          <ReputationMaxButton
            v-if="limitState"
            ref="maxButton"
            :variant="limitState.variant"
            :limit-tokens="limitState.snapshot.limitTokens"
            :max-offer-cents="maxOfferCents"
            @fill="onFill"
          />
          <div ref="tokenDropdown" class="relative overflow-visible">
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
                >{{ selectedToken }}</span
              >
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
                  <div class="w-full flex justify-center">
                    <hr class="w-4/5" />
                  </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </div>
      <div class="custom-divide py-2 mb-2"></div>
      <template v-if="!loadingNetworkLiquidity">
        <div class="flex justify-between">
          <p class="text-gray-500 font-normal text-sm w-auto">
            ~ R$ {{ formatBrlFixed(displayCents) }}
          </p>
          <div class="flex gap-2">
            <img
              v-for="network in availableNetworks"
              :key="network.id"
              :alt="`${network.name} image`"
              :src="getNetworkImage(network.name)"
              width="24"
              height="24"
            />
          </div>
        </div>
        <ReputationChecking v-if="showChecking" />
        <template v-else-if="limitState">
          <ReputationLimitRow
            ref="limitRow"
            :variant="limitState.variant"
            :limit-tokens="limitState.snapshot.limitTokens"
            :expanded="open"
            @toggle="onToggle"
          />
          <ReputationDetailsPanel
            v-if="open"
            v-model:tag="tag"
            :snapshot="limitState.snapshot"
            :network-name="network.name"
            :account-kind="accountKind"
            :amount-cents="displayCents"
            :max-offer-cents="maxOfferCents"
            :limit-changed="refused && refusal?.checkedWithin === true"
            @close="onPanelClose"
          />
        </template>
      </template>
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
          !hasLiquidity &&
          !loadingNetworkLiquidity &&
          !selectedNetworkUnread &&
          tokenValue > 0 &&
          !rowVariant
        "
      >
        <span class="text-red-500 font-normal text-sm"
          >Atualmente não há liquidez nas redes selecionadas para sua
          demanda</span
        >
      </div>
      <div
        class="flex justify-center"
        v-if="failedLiquidityNetworks.length && !loadingNetworkLiquidity"
      >
        <span class="text-red-500 font-normal text-sm"
          >Não foi possível ler a liquidez de:
          {{ failedLiquidityNetworks.map((n) => n.name).join(', ') }}</span
        >
      </div>
      <p class="sr-only" aria-live="polite">{{ announcement }}</p>
    </div>

    <!-- Action buttons -->
    <CustomButton
      v-if="walletAddress"
      type="submit"
      text="Confirmar Oferta"
      :isDisabled="!enableConfirmButton"
      :loading="busy"
      :aria-busy="busy ? 'true' : 'false'"
      aria-label="Confirmar Oferta"
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
</style>

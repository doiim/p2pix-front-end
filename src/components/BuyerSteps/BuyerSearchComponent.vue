<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import { useReputation } from '@/composables/useReputation';
import { useNetworkDepositsQuery } from '@/queries/deposits';
import { useWalletAddress } from '@/queries/wallet';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import CustomButton from '@/components/ui/CustomButton.vue';
import AllowlistBanner from '@/components/BuyerSteps/Reputation/AllowlistBanner.vue';
import ReputationChecking from '@/components/BuyerSteps/Reputation/ReputationChecking.vue';
import ReputationDetailsPanel from '@/components/BuyerSteps/Reputation/ReputationDetailsPanel.vue';
import ReputationLimitRow from '@/components/BuyerSteps/Reputation/ReputationLimitRow.vue';
import ReputationMaxButton from '@/components/BuyerSteps/Reputation/ReputationMaxButton.vue';
import TokenSelector from '@/components/Swap/TokenSelector.vue';
import { verifyNetworkLiquidity } from '@/utils/networkLiquidity';
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
import type {
  BuyPress,
  LimitRowVariant,
  LiquidityRowVariant,
  PanelTag,
} from '@/utils/reputation';
import type { ValidDeposit } from '@/model/ValidDeposit';
import { useConnectModal } from '@/wallet/useConnectModal';
import { TokenEnum } from '@/model/NetworkEnum';
import { findSwapToken } from '@/model/BuyToken';
import { IMPACT_WARN_BPS, quoteLock, type SwapIntent } from '@/blockchain/swap';
import { useSwapQuote } from '@/composables/useSwapQuote';
import { formatEther, zeroAddress } from 'viem';
import { getCurrentAccount } from '@/blockchain/provider';
import { getAaOwnerKind, isAaAvailable } from '@/blockchain/aa/aaContext';
import { findAllowlistProof } from '@/blockchain/allowlist';

// Set by HomeView when the contract refused the lock with AmountNotAllowed: the press it refused,
// read once to seed the form.
const props = defineProps<{ refusal: BuyPress | null }>();

const emit = defineEmits<{
  tokenBuy: [deposit: ValidDeposit, press: BuyPress, swapIntent?: SwapIntent];
}>();

// Store reference
const user = useUser();
const reputation = useReputation();

const { network, selectedToken } = user;
const walletAddress = useWalletAddress();

const depositsQuery = useNetworkDepositsQuery(selectedToken);
const depositsValidList = computed(
  () => depositsQuery.data.value?.deposits ?? [],
);
const failedLiquidityNetworks = computed(
  () => depositsQuery.data.value?.failedNetworks ?? [],
);
const loadingNetworkLiquidity = computed(() => depositsQuery.isPending.value);

// A network whose read failed has unknown liquidity, not zero liquidity.
const selectedNetworkUnread = computed(() =>
  failedLiquidityNetworks.value.some((n) => n.id === network.value.id),
);

// html references
const amountInputEl = useTemplateRef<HTMLInputElement>('amountInput');
const maxButtonEl =
  useTemplateRef<InstanceType<typeof ReputationMaxButton>>('maxButton');
const limitRowEl =
  useTemplateRef<InstanceType<typeof ReputationLimitRow>>('limitRow');

// Reactive state (seeded before any watcher exists, so a refusal does not clear itself)
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

// Token received. Starts on BRZ, what the contract locks: the reputation limit is checked against the
// typed amount itself, while a swap token needs a CoW quote first.
const buyToken = ref<string>(TokenEnum.BRZ);
const swapping = computed(() => !!findSwapToken(network.value, buyToken.value));
const swapQuote = useSwapQuote<{ lockAmount: bigint; impactBps: number }>();
const impactBps = computed(() => swapQuote.result.value?.impactBps ?? null);
const swapIntent = (): SwapIntent | undefined =>
  swapping.value && tokenValue.value > 0
    ? { token: buyToken.value, amount: String(tokenValue.value) }
    : undefined;
// BRZ to lock: the typed amount for BRZ, the quoted cost for a swap token. Limit, liquidity and
// "~ R$" all read this, since the contract only sees BRZ.
const lockWei = computed(() => {
  if (swapping.value) return swapQuote.result.value?.lockAmount ?? null;
  return parsed.value.status === 'ok' ? parsed.value.wei : null;
});
const lockValue = computed(() =>
  lockWei.value === null ? 0 : Number(formatEther(lockWei.value)),
);
const lockCents = computed(() =>
  swapping.value ? (lockWei.value ?? 0n) / 10n ** 16n : displayCents.value,
);

// Offers from other sellers. Lowercase both sides: the subgraph returns lowercase, the wallet checksummed.
const othersDeposits = computed(() => {
  const account = walletAddress.value?.toLowerCase();
  return depositsValidList.value.filter(
    (d) => d.seller.toLowerCase() !== account,
  );
});
const selectedDeposits = computed(() =>
  walletAddress.value
    ? verifyNetworkLiquidity(lockValue.value, othersDeposits.value)
    : [],
);
const selectedDeposit = computed(() =>
  selectedDeposits.value.find((d) => d.network.id === network.value.id),
);
const hasLiquidity = computed(
  () => !walletAddress.value || selectedDeposit.value !== undefined,
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

// No offer from another seller on this network: nothing to buy, whatever the limit says.
const noOffers = computed(
  () =>
    walletAddress.value !== null &&
    !loadingNetworkLiquidity.value &&
    !selectedNetworkUnread.value &&
    maxOfferCents.value === null,
);

// On the seller's on-chain allowlist the limit does not apply: `lock` sends the proof. `null` while the
// check runs, which gives no verdict, like a reputation read in flight.
const proofFound = ref<boolean | null>(false);
// "Comprar sem a lista": behave as if the seller's allowlist did not exist, and send no proof.
const ignoreAllowlist = ref(false);
const allowlisted = computed(() =>
  ignoreAllowlist.value ? false : proofFound.value,
);
// Two getters, not one tuple: a fresh tuple counts as changed on every recompute and re-issues the read.
watch(
  [() => selectedDeposit.value?.seller, walletAddress],
  async ([seller, buyer], _, onCleanup) => {
    let stale = false;
    onCleanup(() => {
      stale = true;
    });
    proofFound.value = seller && buyer ? null : false;
    if (!seller || !buyer) return;
    // A failed lookup only keeps the normal limit.
    const proof = await findAllowlistProof(seller, buyer).catch(() => []);
    if (!stale) proofFound.value = proof.length > 0;
  },
  { immediate: true },
);

// Reputation: no snapshot (guest, loading, failed read) or an allowlist pass means no verdict, so nothing
// renders or blocks.
const verdict = computed(() =>
  reputation.snapshot.value !== null &&
  lockWei.value !== null &&
  allowlisted.value === false
    ? classifyAmount(lockWei.value, reputation.snapshot.value.limitTokens)
    : null,
);
const rowVariant = computed(() =>
  limitRowVariant(verdict.value, refused.value),
);
// The red row, Máx and the red input render together, never while liquidity loads.
const limitState = computed(() =>
  rowVariant.value !== null &&
  reputation.snapshot.value !== null &&
  !noOffers.value &&
  !loadingNetworkLiquidity.value
    ? { variant: rowVariant.value, snapshot: reputation.snapshot.value }
    : null,
);
// No offer covers the amount: the limit row's look, reading the largest offer (2L/2N pattern).
const liquidityRow = computed<{
  variant: LiquidityRowVariant;
  amountCents: bigint | null;
} | null>(() => {
  const blocked =
    !hasLiquidity.value &&
    tokenValue.value > 0 &&
    limitState.value === null &&
    !loadingNetworkLiquidity.value &&
    !selectedNetworkUnread.value &&
    !swapQuote.failed.value;
  if (!blocked) return null;
  const cents = maxOfferCents.value;
  return {
    variant: cents === null ? 'noOffer' : 'overOffer',
    amountCents: cents,
  };
});
const showChecking = computed(
  () =>
    open.value &&
    reputation.snapshot.value === null &&
    reputation.reading.value,
);
// The panel is open only over the limit, so while it re-reads the input keeps its red (spec §4).
const amountInvalid = computed(
  () =>
    limitState.value !== null ||
    showChecking.value ||
    liquidityRow.value !== null,
);
// Same check as usePasskeyAccount.isSmartAccount; reading walletAddress keeps it reactive to connector switches.
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
    lockWei.value !== null &&
    hasLiquidity.value,
);

// Debounced: a quote per keystroke would hammer the order book.
let quoteTimer: ReturnType<typeof setTimeout> | undefined;
watch(
  [tokenValue, buyToken, () => network.value.id, walletAddress],
  () => {
    clearTimeout(quoteTimer);
    const intent = swapIntent();
    if (!intent) return swapQuote.run(null);
    swapQuote.quoting.value = true;
    quoteTimer = setTimeout(
      () =>
        swapQuote.run(() =>
          quoteLock(intent, walletAddress.value ?? zeroAddress),
        ),
      500,
    );
  },
  { immediate: true },
);

// Swap tokens exist only on chains with a CoW config.
watch(network, () => {
  if (!findSwapToken(network.value, buyToken.value))
    buyToken.value = TokenEnum.BRZ;
});

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

// A new seller is a new allowlist: the opt-out was for the previous one.
watch(
  () => selectedDeposit.value?.seller,
  () => {
    ignoreAllowlist.value = false;
  },
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
    amount: lockValue.value,
    checkedWithin,
    skipAllowlist: ignoreAllowlist.value,
  };
  emit('tokenBuy', deposit, press, swapIntent());
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
    read.ok && lockWei.value !== null
      ? limitRowVariant(
          classifyAmount(lockWei.value, read.snapshot.limitTokens),
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
  `${network.value.id}:${walletAddress.value}:${amountText.value}:${buyToken.value}`;

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
    <div
      class="amount-box flex flex-col w-full bg-white sm:px-10 px-6 py-5 rounded-lg"
    >
      <div class="flex justify-between sm:w-full items-center gap-3 sm:gap-4">
        <input
          ref="amountInput"
          v-model="amountText"
          type="text"
          inputmode="decimal"
          name="tokenAmount"
          placeholder="0"
          required
          :aria-label="`Quantidade de ${buyToken}`"
          :aria-invalid="amountInvalid ? 'true' : 'false'"
          :aria-describedby="
            limitState || liquidityRow ? 'rep-status rep-amount' : undefined
          "
          class="flex-1 min-w-0 max-w-[60%] p-0 border-0 outline-none bg-transparent text-xl font-semibold placeholder:text-gray-900/50"
          :class="amountInvalid ? 'text-red-700' : 'text-gray-900'"
        />
        <div class="flex items-center flex-none gap-1 sm:gap-2 ml-auto sm:ml-0">
          <ReputationMaxButton
            v-if="limitState && !swapping"
            ref="maxButton"
            :limit="{
              variant: limitState.variant,
              tokens: limitState.snapshot.limitTokens,
            }"
            :max-offer-cents="maxOfferCents"
            @fill="onFill"
          />
          <ReputationMaxButton
            v-else-if="liquidityRow?.amountCents && !swapping"
            :limit="null"
            :max-offer-cents="liquidityRow.amountCents"
            @fill="onFill"
          />
          <TokenSelector v-model="buyToken" />
        </div>
      </div>
      <div class="custom-divide py-2 mb-2"></div>
      <template v-if="!loadingNetworkLiquidity">
        <p class="text-gray-500 font-normal text-sm">
          ~ R$
          {{ swapQuote.quoting.value ? 'cotando…' : formatBrlFixed(lockCents) }}
        </p>
        <ReputationChecking v-if="showChecking" />
        <template v-else-if="limitState">
          <ReputationLimitRow
            ref="limitRow"
            :variant="limitState.variant"
            :amount-cents="limitState.snapshot.limitTokens * 100n"
            :expanded="open"
            @toggle="onToggle"
          />
          <ReputationDetailsPanel
            v-if="open"
            v-model:tag="tag"
            :snapshot="limitState.snapshot"
            :network-name="network.name"
            :account-kind="accountKind"
            :amount-cents="lockCents"
            :max-offer-cents="maxOfferCents"
            :limit-changed="refused && refusal?.checkedWithin === true"
            @close="onPanelClose"
          />
        </template>
        <ReputationLimitRow
          v-else-if="liquidityRow"
          :variant="liquidityRow.variant"
          :amount-cents="liquidityRow.amountCents"
          :expanded="null"
        />
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
        v-if="impactBps !== null && impactBps > IMPACT_WARN_BPS"
      >
        <span class="text-amber-600 font-normal text-sm text-center"
          >Impacto de preço de {{ (impactBps / 100).toFixed(1) }}% pela liquidez
          disponível agora.</span
        >
      </div>
      <div class="flex justify-center" v-if="swapQuote.failed.value">
        <span class="text-red-500 font-normal text-sm text-center"
          >Sem cotação para {{ buyToken }} agora. Tente outro valor ou escolha
          {{ TokenEnum.BRZ }}.</span
        >
      </div>
      <div
        class="flex justify-center"
        v-else-if="!validDecimals && !loadingNetworkLiquidity"
      >
        <span class="text-red-500 font-normal text-sm"
          >Por favor utilize no máximo 2 casas decimais</span
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
      :isDisabled="!enableConfirmButton || swapQuote.quoting.value"
      :loading="busy"
      :aria-busy="busy ? 'true' : 'false'"
      aria-label="Confirmar Oferta"
    />
    <CustomButton
      v-else
      text="Conectar carteira"
      @buttonClicked="connectAccount()"
    />
    <!-- Design 2I1A: the seller's list is a card of its own, under the button. -->
    <AllowlistBanner
      v-if="
        proofFound === true &&
        !ignoreAllowlist &&
        !loadingNetworkLiquidity &&
        selectedDeposit
      "
      :seller="selectedDeposit.seller"
      :network-name="network.name"
      :limit-tokens="reputation.snapshot.value?.limitTokens ?? null"
      @ignore="ignoreAllowlist = true"
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
/* The amount field has no outline of its own: its divider shows the focus. */
.amount-box:has(input[name='tokenAmount']:focus-visible) .custom-divide {
  border-bottom-color: #3730a3;
  box-shadow: 0 1px 0 #3730a3;
}
</style>

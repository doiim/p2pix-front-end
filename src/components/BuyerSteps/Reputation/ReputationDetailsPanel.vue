<script setup lang="ts">
import { computed } from 'vue';
import {
  buildLimitChart,
  CHART_WIDE,
  formatBrl,
  formatTokens,
  LOCKAMOUNT_UPPERBOUND_TOKENS,
  REPUTATION_LOWERBOUND_TOKENS,
} from '@/utils/reputation';
import type {
  AccountKind,
  PanelTag,
  ReputationSnapshot,
} from '@/utils/reputation';
import ReputationChart from './ReputationChart.vue';
import ReputationHowItWorks from './ReputationHowItWorks.vue';
import ReputationTagGroup from './ReputationTagGroup.vue';
import ReputationVerification from './ReputationVerification.vue';

const props = defineProps<{
  snapshot: ReputationSnapshot;
  networkName: string;
  accountKind: AccountKind;
  amountCents: bigint;
  maxOfferCents: bigint | null;
  limitChanged: boolean; // P9: the contract refused an amount the last read said fits
  tag: PanelTag | null;
}>();

const emit = defineEmits<{
  'update:tag': [tag: PanelTag | null];
  close: [];
}>();

const chartAvailable = computed(
  () =>
    buildLimitChart(
      {
        curve: props.snapshot.curve,
        creditTokens: props.snapshot.creditTokens,
        limitTokens: props.snapshot.limitTokens,
        amountCents: props.amountCents,
      },
      CHART_WIDE,
    ).kind !== 'none',
);

const tags = computed(() =>
  (['chart', 'howItWorks', 'verification'] as const).filter(
    (item) => item !== 'chart' || chartAvailable.value,
  ),
);

const activeTag = computed(() =>
  props.tag !== null && tags.value.includes(props.tag) ? props.tag : null,
);

const excessCents = computed(() => {
  const excess = props.amountCents - props.snapshot.limitTokens * 100n;
  return excess > 0n ? excess : 0n;
});

// Same condition as the Máx "offer" binding: a smaller offer is what one purchase can reach.
const offerCents = computed(() =>
  props.maxOfferCents !== null &&
  props.maxOfferCents < props.snapshot.limitTokens * 100n
    ? props.maxOfferCents
    : null,
);

// At most one of limit changed > new account > cap; the offer note may follow it.
const leadNote = computed(() => {
  if (props.limitChanged) return 'limitChanged';
  if (props.snapshot.creditTokens === 0n) return 'newAccount';
  return props.snapshot.limitTokens === LOCKAMOUNT_UPPERBOUND_TOKENS
    ? 'cap'
    : null;
});

const accountNoun = computed(() =>
  props.accountKind === 'smartAccount' ? 'conta inteligente' : 'carteira',
);
</script>

<template>
  <div class="flex flex-col pt-2">
    <div
      aria-hidden="true"
      class="w-0 h-0 border-x-8 border-x-transparent border-b-8 border-b-gray-100"
    ></div>
    <div
      id="rep-details"
      role="region"
      aria-label="Detalhes do limite"
      class="flex flex-col p-3 sm:p-4 rounded-lg bg-gray-100"
      @keydown.esc="emit('close')"
    >
      <template v-if="activeTag === null">
        <p class="m-0 text-sm font-medium text-gray-600">
          Seu limite por compra em {{ networkName }}
        </p>
        <p class="mt-0.5 text-xl font-semibold text-gray-900 whitespace-nowrap">
          R$ {{ formatTokens(snapshot.limitTokens) }}
        </p>
        <div
          aria-hidden="true"
          class="h-1.5 mt-2.5 rounded-[3px] overflow-hidden bg-gray-300"
        >
          <div class="w-full h-1.5 bg-red-700"></div>
        </div>
        <p class="mt-2 text-sm text-red-700">
          Esta compra passa
          <span class="whitespace-nowrap">R$ {{ formatBrl(excessCents) }}</span>
          do seu limite.
        </p>
        <div aria-hidden="true" class="h-px my-3 bg-gray-300"></div>
        <p class="m-0 text-sm text-gray-600">
          No P2Pix cada conta tem um limite de compra por rede baseado no
          histórico da sua reputação para evitar fraudes.
        </p>
        <p
          v-if="leadNote === 'limitChanged'"
          class="mt-2 text-sm text-gray-600"
        >
          Seu limite mudou desde a última leitura. Isso acontece, por exemplo,
          quando uma reserva expirada é devolvida: o crédito cai pela metade
          (nunca abaixo de <span class="whitespace-nowrap">R$ 100</span>).
        </p>
        <p
          v-else-if="leadNote === 'newAccount'"
          class="mt-2 text-sm text-gray-600"
        >
          Esta {{ accountNoun }} ainda não tem crédito de reputação em
          {{ networkName }}.
          <template
            v-if="snapshot.newWalletLimitTokens > REPUTATION_LOWERBOUND_TOKENS"
            >Toda carteira começa com
            <span class="whitespace-nowrap"
              >R$ {{ formatTokens(snapshot.newWalletLimitTokens) }}</span
            >
            por compra.</template
          >
          <template v-else
            >Compras de até <span class="whitespace-nowrap">R$ 100</span> não
            precisam de reputação.</template
          >
        </p>
        <p v-else-if="leadNote === 'cap'" class="mt-2 text-sm text-gray-600">
          Você atingiu o máximo do contrato:
          <span class="whitespace-nowrap">R$ 1.000.000</span> por compra.
        </p>
        <p v-if="offerCents !== null" class="mt-2 text-sm text-gray-600">
          Maior oferta em {{ networkName }} agora:
          <strong class="font-semibold text-gray-900 whitespace-nowrap"
            >R$ {{ formatBrl(offerCents) }}</strong
          >. Cada compra usa uma única oferta.
        </p>
      </template>
      <ReputationChart
        v-else-if="activeTag === 'chart'"
        :curve="snapshot.curve"
        :credit-tokens="snapshot.creditTokens"
        :limit-tokens="snapshot.limitTokens"
        :amount-cents="amountCents"
      />
      <ReputationHowItWorks
        v-else-if="activeTag === 'howItWorks'"
        :limit-tokens="snapshot.limitTokens"
        :next-limit-tokens="snapshot.nextLimitTokens"
        :new-wallet-limit-tokens="snapshot.newWalletLimitTokens"
        :offer-binds="offerCents !== null"
        :account-kind="accountKind"
        :account="snapshot.account"
        :network-name="networkName"
      />
      <ReputationVerification
        v-else
        :snapshot="snapshot"
        :network-name="networkName"
      />
      <ReputationTagGroup
        :tag="activeTag"
        :tags="tags"
        @update:tag="emit('update:tag', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { formatTokens } from '@/utils/reputation';
import type { CapChart, GrowthChart, LimitChart } from '@/utils/reputation';

const props = defineProps<{
  limitChart: LimitChart; // built once by the panel, for the layout on screen
  limitTokens: bigint;
}>();

const growthAria = (text: GrowthChart['text']) =>
  [
    'Gráfico do limite por compra em função do crédito de reputação, em escala logarítmica nos dois eixos.',
    text.flatUntil === null
      ? null
      : `Até R$ ${text.flatUntil} de crédito o limite fica em R$ 100.`,
    `Você está em R$ ${text.credit} de crédito, com limite de R$ ${text.limit} por compra.`,
    `Para comprar R$ ${text.amount} de uma vez, o crédito precisa chegar a R$ ${text.need}: mais R$ ${text.missing} em compras.`,
  ]
    .filter((sentence): sentence is string => sentence !== null)
    .join(' ');

const capAria = (text: CapChart['text']) =>
  `Gráfico do limite por compra em função do crédito de reputação, em escala logarítmica. Você está em R$ ${text.credit} de crédito, no teto de R$ 1.000.000. R$ ${text.amount} fica acima do teto.`;

const growthCharts = computed(() => {
  const chart = props.limitChart;
  return chart.kind === 'growth'
    ? [
        {
          ...chart,
          aria: growthAria(chart.text),
          visibleTicks: chart.ticks.filter((tick) => tick.visible),
        },
      ]
    : [];
});

const capCharts = computed(() => {
  const chart = props.limitChart;
  return chart.kind === 'capReached'
    ? [
        {
          ...chart,
          aria: capAria(chart.text),
          visibleTicks: chart.ticks.filter((tick) => tick.visible),
        },
      ]
    : [];
});

const limitText = computed(() => formatTokens(props.limitTokens));
</script>

<!-- SVG text is bound with v-text: template whitespace inside a tspan with its own x would shift the label. -->
<template>
  <p v-if="limitChart.kind === 'beyondCap'" class="m-0 text-sm text-gray-600">
    Nenhuma reputação permite comprar mais de
    <span class="whitespace-nowrap">R$ 1.000.000</span> de uma vez.
  </p>
  <div
    v-else-if="limitChart.kind === 'growth' || limitChart.kind === 'capReached'"
    class="flex flex-col gap-2 p-3 rounded-lg bg-white"
  >
    <p class="m-0 text-xs font-semibold text-gray-900">
      Como seu limite cresce
    </p>
    <!-- w-fit keeps the axis caption at the chart's right edge on a wider card; on a card narrower than
         the chart (320px screens) max-w-full and h-auto scale the SVG down through its viewBox. -->
    <div class="flex flex-col gap-1 w-fit max-w-full">
      <p class="m-0 text-xs text-gray-600">Limite por compra (R$)</p>
      <svg
        v-for="chart in growthCharts"
        :key="chart.kind"
        :width="chart.width"
        :height="chart.height"
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        role="img"
        :aria-label="chart.aria"
        class="overflow-visible max-w-full h-auto"
      >
        <line
          v-for="x in chart.decadeXs"
          :key="x"
          :x1="x"
          :y1="chart.plotTop"
          :x2="x"
          :y2="chart.baselineY"
          stroke-width="1"
          class="stroke-gray-100"
        />
        <line
          :x1="chart.plotLeft"
          :y1="chart.cap.y"
          :x2="chart.plotRight"
          :y2="chart.cap.y"
          stroke-width="1"
          class="stroke-gray-200"
        />
        <text
          :x="chart.plotLeft"
          :y="chart.cap.labelY"
          text-anchor="start"
          paint-order="stroke"
          stroke-linejoin="round"
          class="text-xs tabular-nums fill-gray-600 stroke-white stroke-4"
          v-text="'Teto do contrato · 1.000.000'"
        />
        <line
          :x1="chart.plotLeft"
          :y1="chart.baselineY"
          :x2="chart.plotRight"
          :y2="chart.baselineY"
          stroke-width="1"
          class="stroke-gray-300"
        />
        <line
          :x1="chart.goal.x"
          :y1="chart.goal.y"
          :x2="chart.goal.x"
          :y2="chart.baselineY"
          stroke-width="1"
          class="stroke-gray-300"
        />
        <path
          :d="chart.curvePath"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="stroke-gray-600"
        />
        <path
          :d="chart.highlightPath"
          fill="none"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="stroke-emerald-600"
        />
        <circle
          :cx="chart.goal.x"
          :cy="chart.goal.y"
          r="5"
          stroke-width="2.5"
          class="fill-white stroke-emerald-600"
        />
        <circle
          :cx="chart.you.x"
          :cy="chart.you.y"
          r="5"
          stroke-width="2"
          class="fill-gray-900 stroke-white"
        />
        <template v-if="chart.labels">
          <text
            :x="chart.labels.you.x"
            :y="chart.labels.you.y"
            :text-anchor="chart.labels.you.anchor"
            paint-order="stroke"
            stroke-linejoin="round"
            class="text-xs stroke-white stroke-4"
          >
            <tspan
              :x="chart.labels.you.x"
              class="font-semibold fill-gray-900"
              v-text="'Você está aqui'"
            />
            <tspan
              :x="chart.labels.you.x"
              dy="14"
              class="fill-gray-600"
              v-text="`R$ ${chart.text.limit}`"
            />
          </text>
          <text
            :x="chart.labels.goal.x"
            :y="chart.labels.goal.y"
            :text-anchor="chart.labels.goal.anchor"
            paint-order="stroke"
            stroke-linejoin="round"
            class="text-xs stroke-white stroke-4"
          >
            <tspan
              :x="chart.labels.goal.x"
              class="font-semibold fill-gray-900"
              v-text="'Para comprar'"
            />
            <tspan
              :x="chart.labels.goal.x"
              dy="14"
              class="fill-gray-600"
              v-text="`R$ ${chart.text.amount}`"
            />
          </text>
        </template>
        <text
          v-for="(tick, index) in chart.visibleTicks"
          :key="index"
          :x="tick.x"
          :y="chart.tickY"
          :text-anchor="tick.anchor"
          class="text-xs tabular-nums fill-gray-600"
          v-text="tick.label"
        />
      </svg>
      <svg
        v-for="chart in capCharts"
        :key="chart.kind"
        :width="chart.width"
        :height="chart.height"
        :viewBox="`0 0 ${chart.width} ${chart.height}`"
        role="img"
        :aria-label="chart.aria"
        class="overflow-visible max-w-full h-auto"
      >
        <line
          v-for="x in chart.decadeXs"
          :key="x"
          :x1="x"
          :y1="chart.plotTop"
          :x2="x"
          :y2="chart.baselineY"
          stroke-width="1"
          class="stroke-gray-100"
        />
        <line
          :x1="chart.plotLeft"
          :y1="chart.cap.y"
          :x2="chart.plotRight"
          :y2="chart.cap.y"
          stroke-width="1"
          class="stroke-gray-200"
        />
        <text
          :x="chart.plotLeft"
          :y="chart.cap.labelY"
          text-anchor="start"
          paint-order="stroke"
          stroke-linejoin="round"
          class="text-xs tabular-nums fill-gray-600 stroke-white stroke-4"
          v-text="'Teto do contrato · 1.000.000'"
        />
        <line
          :x1="chart.plotLeft"
          :y1="chart.baselineY"
          :x2="chart.plotRight"
          :y2="chart.baselineY"
          stroke-width="1"
          class="stroke-gray-300"
        />
        <line
          :x1="chart.you.x"
          :y1="chart.you.y"
          :x2="chart.you.x"
          :y2="chart.baselineY"
          stroke-width="1"
          class="stroke-gray-300"
        />
        <path
          :d="chart.curvePath"
          fill="none"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="stroke-gray-600"
        />
        <line
          :x1="chart.you.x"
          :y1="chart.you.y"
          :x2="chart.goal.x"
          :y2="chart.goal.y"
          stroke-width="2"
          stroke-dasharray="3 3"
          class="stroke-red-700"
        />
        <circle
          :cx="chart.goal.x"
          :cy="chart.goal.y"
          r="5"
          stroke-width="2.5"
          class="fill-white stroke-red-700"
        />
        <circle
          :cx="chart.you.x"
          :cy="chart.you.y"
          r="5"
          stroke-width="2"
          class="fill-gray-900 stroke-white"
        />
        <template v-if="chart.labels">
          <text
            :x="chart.labels.goal.x"
            :y="chart.labels.goal.y"
            text-anchor="end"
            paint-order="stroke"
            stroke-linejoin="round"
            class="text-xs stroke-white stroke-4"
          >
            <tspan
              class="font-semibold fill-gray-900"
              v-text="'Para comprar '"
            />
            <tspan class="fill-red-700" v-text="`R$ ${chart.text.amount}`" />
          </text>
          <text
            :x="chart.labels.you.x"
            :y="chart.labels.you.y"
            text-anchor="end"
            paint-order="stroke"
            stroke-linejoin="round"
            class="text-xs stroke-white stroke-4"
          >
            <tspan
              :x="chart.labels.you.x"
              class="font-semibold fill-gray-900"
              v-text="'Você está aqui'"
            />
            <tspan
              :x="chart.labels.you.x"
              dy="14"
              class="fill-gray-600"
              v-text="`R$ ${limitText}`"
            />
          </text>
        </template>
        <text
          v-for="(tick, index) in chart.visibleTicks"
          :key="index"
          :x="tick.x"
          :y="chart.tickY"
          :text-anchor="tick.anchor"
          class="text-xs tabular-nums fill-gray-600"
          v-text="tick.label"
        />
      </svg>
      <p
        v-if="limitChart.kind === 'growth'"
        class="m-0 text-xs text-gray-600 text-right"
      >
        Crédito de reputação (R$, escala log)
      </p>
    </div>
    <div v-if="!limitChart.labels" class="flex flex-col gap-1">
      <div class="flex items-center gap-2 text-xs text-gray-600">
        <span
          aria-hidden="true"
          class="flex-none size-2.5 rounded-full bg-gray-900"
        ></span>
        <span class="text-gray-600"
          ><strong class="font-semibold text-gray-900">Você está aqui</strong> ·
          R$
          {{
            limitChart.kind === 'growth' ? limitChart.text.limit : limitText
          }}</span
        >
      </div>
      <div class="flex items-center gap-2 text-xs text-gray-600">
        <span
          aria-hidden="true"
          class="flex-none size-2.5 box-border rounded-full border-[2.5px] bg-white"
          :class="
            limitChart.kind === 'growth'
              ? 'border-emerald-600'
              : 'border-red-700'
          "
        ></span>
        <span class="text-gray-600"
          ><strong class="font-semibold text-gray-900">Para comprar</strong> ·
          R$ {{ limitChart.text.amount }}</span
        >
      </div>
    </div>
    <div class="flex items-start gap-2 pt-2.5 border-t border-gray-200">
      <template v-if="limitChart.kind === 'growth'">
        <span
          aria-hidden="true"
          class="flex-none w-3 h-[3px] mt-[9px] rounded-[2px] bg-emerald-600"
        ></span>
        <p class="m-0 text-sm text-gray-600">
          Para comprar
          <strong class="font-semibold text-gray-900 whitespace-nowrap"
            >R$ {{ limitChart.text.amount }}</strong
          >
          de uma vez, conclua antes mais
          <strong class="font-semibold text-gray-900 whitespace-nowrap"
            >R$ {{ limitChart.text.missing }}</strong
          >
          em compras.
        </p>
      </template>
      <template v-else>
        <span
          aria-hidden="true"
          class="flex-none w-3 h-0 mt-2.5 border-t-2 border-dashed border-red-700"
        ></span>
        <p class="m-0 text-sm text-gray-600">
          Nenhuma reputação permite comprar mais de
          <strong class="font-semibold text-gray-900 whitespace-nowrap"
            >R$ 1.000.000</strong
          >
          de uma vez.
        </p>
      </template>
    </div>
  </div>
</template>

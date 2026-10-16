<script setup lang="ts">
import { onMounted, watch } from 'vue';
import RedirectIcon from '@/assets/redirect.svg';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import {
  useAccountActivity,
  type ActivityItem,
} from '@/composables/account/useAccountActivity';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { useUser } from '@/composables/useUser';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import AccountEmptyState from './AccountEmptyState.vue';

const account = usePasskeyAccount();
const activity = useAccountActivity();
const user = useUser();

const amountText = (item: ActivityItem): string =>
  item.amount === 0n
    ? ''
    : `${item.direction === 'in' ? '+' : item.direction === 'out' ? '−' : ''}${formatTokenAmount(item.amount, account.decimalsOf(item.token))} ${account.symbolOf(item.token)}`;

const dateText = (ts: number): string =>
  new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

onMounted(() => void activity.refresh());
watch(
  () => user.network.value.id,
  () => void activity.refresh(),
);
</script>

<template>
  <p v-if="activity.isEmpty.value && activity.loading.value" class="acct-empty">
    <SpinnerComponent width="6" height="6" class="mx-auto" />
  </p>
  <AccountEmptyState
    v-else-if="activity.isEmpty.value"
    message="Nenhuma atividade ainda. Suas transações aparecerão aqui."
  />
  <div v-else class="flex flex-col gap-3">
    <section v-for="group in activity.groups.value" :key="group.title">
      <p class="text-xs font-medium text-gray-400">{{ group.title }}</p>
      <ul class="divide-y divide-gray-200">
        <li v-for="item in group.items" :key="item.id" class="acct-row">
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="text-sm font-semibold text-gray-900">
              {{ item.title }}
            </span>
            <span class="text-xs text-gray-400">
              {{ dateText(item.timestamp) }}
            </span>
          </span>
          <span
            class="text-sm"
            :class="
              item.direction === 'in' ? 'text-emerald-500' : 'text-gray-900'
            "
          >
            {{ amountText(item) }}
          </span>
          <a
            v-if="item.href"
            :href="item.href"
            target="_blank"
            rel="noopener noreferrer"
            class="acct-link"
            aria-label="Ver no explorador"
          >
            <RedirectIcon class="h-4 w-4 [&_path]:fill-current" />
          </a>
        </li>
      </ul>
    </section>
    <SpinnerComponent
      v-if="activity.loading.value"
      width="4"
      height="4"
      class="mx-auto"
    />
    <p v-if="activity.error.value" class="text-center text-xs text-red-500">
      {{ activity.error.value }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import ArrowIcon from '@/assets/arrow.svg';
import ChevronDown from '@/assets/chevronDown.svg';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import {
  useAccountActivity,
  type ActivityItem,
} from '@/composables/account/useAccountActivity';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { getNetworkImage, getTokenImage } from '@/utils/imagesPath';
import { useUser } from '@/composables/useUser';

const SIGN: Record<ActivityItem['direction'], string> = {
  in: '+ ',
  out: '− ',
  neutral: '',
};

const account = usePasskeyAccount();
const activity = useAccountActivity();
const user = useUser();
const openId = ref<string | null>(null);

const amountText = (item: ActivityItem): string =>
  item.amount === 0n
    ? ''
    : `${SIGN[item.direction]}${formatTokenAmount(item.amount, account.decimalsOf(item.token))} ${account.symbolOf(item.token)}`;

const dateText = (ts: number): string =>
  new Date(ts)
    .toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
    .replace(', ', ' · ');

const imageOf = (item: ActivityItem): string =>
  item.token
    ? getTokenImage(item.token)
    : getNetworkImage(user.network.value.name);

const toggle = (id: string) => {
  openId.value = openId.value === id ? null : id;
};

onMounted(() => void activity.refresh());
// A new balance means a send, purchase or deposit just landed.
watch(
  [() => user.network.value.id, account.balances, account.ethBalance],
  () => void activity.refresh(),
);
</script>

<template>
  <section
    v-if="
      account.isReady.value && (!activity.isEmpty.value || activity.error.value)
    "
    class="w-full flex flex-col px-4 sm:px-6 pt-4 pb-2 rounded-lg bg-white"
  >
    <h3 class="text-base font-bold text-gray-900">Histórico</h3>
    <div v-for="group in activity.groups.value" :key="group.title">
      <p class="mt-2 text-xs font-semibold text-gray-600">{{ group.title }}</p>
      <ul>
        <li
          v-for="item in group.items"
          :key="item.id"
          class="border-b border-gray-100 last:border-b-0"
        >
          <button
            type="button"
            :aria-expanded="item.href ? openId === item.id : undefined"
            :disabled="!item.href"
            class="flex items-center gap-3 w-full min-h-15 py-2.5 text-left text-gray-900 enabled:cursor-pointer"
            @click="toggle(item.id)"
          >
            <span class="relative flex shrink-0">
              <img :src="imageOf(item)" alt="" class="w-8 h-8 rounded-full" />
              <span
                v-if="item.direction !== 'neutral'"
                class="absolute -right-0.5 -bottom-0.5 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-white"
              >
                <ArrowIcon
                  aria-hidden="true"
                  class="scale-50 [&_path]:fill-gray-900"
                  :class="{ 'rotate-180': item.direction === 'out' }"
                />
              </span>
            </span>
            <span class="flex flex-col flex-1 min-w-0">
              <span class="text-sm font-semibold truncate">{{
                item.title
              }}</span>
              <span class="text-xs text-gray-500">{{
                dateText(item.timestamp)
              }}</span>
            </span>
            <span class="text-sm font-semibold whitespace-nowrap">
              {{ amountText(item) }}
            </span>
            <ChevronDown
              v-if="item.href"
              aria-hidden="true"
              class="shrink-0 w-4 h-4 text-gray-500 transition-transform"
              :class="{ 'rotate-180': openId === item.id }"
            />
          </button>
          <div v-if="item.href && openId === item.id" class="pl-11 pb-3">
            <a
              :href="item.href"
              target="_blank"
              rel="noopener noreferrer"
              class="acct-link text-sm"
            >
              Ver no {{ user.network.value.blockExplorers?.default.name }}
            </a>
          </div>
        </li>
      </ul>
    </div>
    <p
      v-if="activity.error.value"
      class="py-2 text-center text-xs text-red-500"
    >
      Não foi possível carregar o histórico.
    </p>
  </section>
</template>

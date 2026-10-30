<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { formatUnits, type Address, type Hex } from 'viem';
import CustomButton from '@/components/ui/CustomButton.vue';
import StatusBadge, { type StatusType } from '@/components/ui/StatusBadge.vue';
import {
  getSwapOrder,
  separatePrompts,
  tokenDecimals,
} from '@/blockchain/swap';
import { promptsNotice } from '@/utils/walletPrompts';
import type { OrderState, OrderStatus } from '@/utils/cowApi';
import { ORDER_VALIDITY_SECONDS } from '@/blockchain/cowOrder';
import { useUser } from '@/composables/useUser';

/**
 * A CoW order's status card, for both sides: the buyer trading released BRZ
 * for another token, and the seller buying BRZ before the deposit.
 */
const props = defineProps<{
  orderUid: Hex | null;
  /** Token the order buys. */
  token: string;
  tokenAddress: Address;
  /** Token the order sells, which stays in the wallet if it does not fill. */
  keep: string;
  requote: () => Promise<Hex>;
  cancel: (uid: Hex) => Promise<void>;
}>();

const emit = defineEmits<{ fulfilled: [] }>();

const user = useUser();
const uid = ref<Hex | null>(props.orderUid);
const order = ref<OrderState | null>(null);
const busy = ref<boolean>(false);
const actionError = ref<string>('');
const decimals = ref<number | null>(null);
const requoteNotice = ref<string | null>(null);

const BADGES: Record<OrderStatus, { status: StatusType; text: string }> = {
  presignaturePending: { status: 'pending', text: 'Aguardando execução' },
  open: { status: 'pending', text: 'Aguardando execução' },
  fulfilled: { status: 'completed', text: 'Concluída' },
  expired: { status: 'expired', text: 'Expirada' },
  cancelled: { status: 'expired', text: 'Cancelada' },
};

const isLive = computed(
  () =>
    uid.value !== null &&
    (order.value === null ||
      order.value.status === 'open' ||
      order.value.status === 'presignaturePending'),
);

const badge = computed(() =>
  uid.value === null
    ? { status: 'expired' as const, text: 'Não enviada' }
    : BADGES[order.value?.status ?? 'open'],
);

const received = computed(() =>
  order.value?.status === 'fulfilled' && decimals.value !== null
    ? formatUnits(order.value.executedBuyAmount, decimals.value)
    : null,
);

const refresh = async (): Promise<void> => {
  if (!uid.value) return;
  order.value = await getSwapOrder(uid.value).catch((cause) => {
    console.error('[swap] order status unavailable', cause);
    return order.value;
  });
};

const run = async (action: () => Promise<void>, failure: string) => {
  busy.value = true;
  actionError.value = '';
  await action().catch((cause) => {
    console.error('[swap]', cause);
    actionError.value = failure;
  });
  busy.value = false;
};

const withdraw = () =>
  run(async () => {
    if (uid.value) await props.cancel(uid.value);
    await refresh();
  }, 'Não foi possível cancelar a ordem. Tente de novo.');

const requote = () =>
  run(async () => {
    uid.value = await props.requote();
    order.value = null;
    await refresh();
  }, 'Não foi possível cotar de novo. Tente em instantes.');

watch(
  () => order.value?.status,
  (status) => {
    if (status === 'fulfilled') emit('fulfilled');
  },
);

let poll: ReturnType<typeof setInterval> | undefined;

onMounted(async () => {
  decimals.value = await tokenDecimals(user.network.value, props.tokenAddress);
  requoteNotice.value = promptsNotice(
    await separatePrompts(false).catch(() => []),
    { sell: props.keep, buy: props.token },
  );
  await refresh();
  poll = setInterval(() => {
    if (isLive.value) refresh();
  }, 10_000);
});

onUnmounted(() => clearInterval(poll));
</script>

<template>
  <div class="flex flex-col w-full bg-white px-10 py-5 rounded-lg gap-3">
    <div class="flex justify-between items-center gap-2">
      <p class="text-gray-900">Troca para {{ token }}</p>
      <StatusBadge :status="badge.status" :custom-text="badge.text" />
    </div>
    <p v-if="received" class="text-2xl text-gray-900">
      {{ received }} {{ token }}
    </p>
    <p v-else-if="isLive" class="text-sm text-gray-900">
      A ordem vale por {{ ORDER_VALIDITY_SECONDS / 60 }} minutos. Se não for
      executada, o {{ keep }} fica na sua carteira.
    </p>
    <p v-else class="text-sm text-gray-900">
      O {{ keep }} está na sua carteira. Você pode cotar a troca de novo.
    </p>
    <p v-if="actionError" class="text-sm text-red-500">{{ actionError }}</p>
    <CustomButton
      v-if="isLive"
      :text="`Ficar com ${keep}`"
      variant="outline"
      :loading="busy"
      @buttonClicked="withdraw"
    />
    <template v-else-if="!received">
      <p v-if="requoteNotice" class="text-sm text-gray-900">
        {{ requoteNotice }}
      </p>
      <CustomButton
        text="Cotar de novo"
        :loading="busy"
        @buttonClicked="requote"
      />
    </template>
  </div>
</template>

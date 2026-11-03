<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { parseEther, type Hex } from 'viem';

import SellerComponent from '@/components/SellerSteps/SellerComponent.vue';
import AccountLayout from '@/components/SmartAccount/AccountLayout.vue';
import ActivityTab from '@/components/SmartAccount/ActivityTab.vue';
import OfferTabs from '@/components/SmartAccount/OfferTabs.vue';
import SwapOrderStatus from '@/components/Swap/SwapOrderStatus.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import { useUser } from '@/composables/useUser';
import { useMutation } from '@tanstack/vue-query';
import { approveTokens } from '@/blockchain/sellerMethods';
import {
  buyBrz,
  cancelSwap,
  clearPendingSellSwap,
  getSwapOrder,
  loadPendingSellSwap,
  savePendingSellSwap,
  separatePrompts,
} from '@/blockchain/swap';
import { useWalletAddress } from '@/queries/wallet';
import { useAddDepositMutation } from '@/queries/mutations';
import CustomButton from '@/components/ui/CustomButton.vue';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import { findSwapToken } from '@/model/BuyToken';
import { TokenEnum, type SwapToken } from '@/model/NetworkEnum';
import { promptsNotice, walletErrorMessage } from '@/utils/walletPrompts';
import type { Participant } from '@/utils/bbPay';

enum Step {
  Search,
  Sell,
  Swap,
}

const user = useUser();
user.setSellerView(true);

const flowStep = ref<Step>(Step.Sell);
// The swap order is sent outside the mutations, so it has its own flag.
const swapStarting = ref<boolean>(false);
const loadingMessage = ref<string>(
  'A transação está sendo enviada para a rede.',
);
const showAlert = ref<boolean>(false);
// The offer waiting on its CoW order: the seller pays `token` for the BRZ.
const swap = ref<{
  participant: Participant;
  token: SwapToken;
  uid: Hex | null;
}>();

// Leaving while the order is live would stop its poll and strand the filled BRZ.
const orderLive = ref(false);
// The order filled: the BRZ is in the wallet, so only the deposit is left to retry.
const brzReady = ref(false);
const DEPOSIT_RETRY =
  'O BRZ já está na sua carteira. Tente o depósito de novo.';

const walletAddress = useWalletAddress();
const chainId = computed(() => user.network.value.id);

// The live or filled-but-undeposited order outlives a reload, per chain and account.
const rememberSwap = () => {
  const pending = swap.value;
  if (!pending?.uid || !walletAddress.value) return;
  savePendingSellSwap(chainId.value, walletAddress.value, {
    uid: pending.uid,
    symbol: pending.token.symbol,
    participant: pending.participant,
  });
};

const forgetSwap = () => {
  if (walletAddress.value)
    clearPendingSellSwap(chainId.value, walletAddress.value);
};

const brzAddress = computed(
  () => user.network.value.tokens[TokenEnum.BRZ].address,
);

const approveMutation = useMutation({ mutationFn: approveTokens });
const addDepositMutation = useAddDepositMutation();
// Covers the gap between the approve and deposit mutations.
const sending = ref<boolean>(false);
const defaultMessage = 'A transação está sendo enviada para a rede.';
const loading = computed(
  () =>
    sending.value ||
    approveMutation.isPending.value ||
    addDepositMutation.isPending.value ||
    swapStarting.value,
);

// Verificar tipagem
const approveOffer = async (args: Participant, paySymbol?: string) => {
  const token = paySymbol
    ? findSwapToken(user.network.value, paySymbol)
    : undefined;
  if (token) return startSwap(args, token);
  await sendOffer(args);
};

/**
 * Approve (skipped when the allowance covers the offer, and on the smart
 * account rail where the deposit UserOperation carries the approval), then
 * deposit.
 */
const sendOffer = async (args: Participant) => {
  sending.value = true;
  try {
    loadingMessage.value = 'Aprovando tokens…';
    await approveMutation.mutateAsync(args);
    loadingMessage.value = 'Enviando oferta para a rede…';
    await addDepositMutation.mutateAsync();
    if (swap.value) forgetSwap();
    brzReady.value = false;
    showAlert.value = true;
  } catch (err) {
    console.error(err);
    user.showToast(
      'error',
      brzReady.value
        ? DEPOSIT_RETRY
        : walletErrorMessage(
            err,
            'Não foi possível criar a oferta. Tente novamente.',
          ),
    );
  } finally {
    flowStep.value = brzReady.value ? Step.Swap : Step.Sell;
    sending.value = false;
    loadingMessage.value = defaultMessage;
  }
};

/** Buys the offer's BRZ with `token`; the deposit follows once it fills. */
const startSwap = async (args: Participant, token: SwapToken) => {
  brzReady.value = false;
  swapStarting.value = true;
  forgetSwap();
  const notice =
    promptsNotice(await separatePrompts(false).catch(() => []), {
      sell: token.symbol,
      buy: TokenEnum.BRZ,
    }) ?? 'A ordem de troca está sendo enviada.';
  // The deposit cannot ride in the order: it needs the BRZ the order delivers.
  loadingMessage.value = `${notice} Quando a troca executar, a carteira ainda pede a aprovação e o depósito do ${TokenEnum.BRZ}.`;
  const uid = await buySwapBrz(args, token).catch((cause) => {
    console.error('[swap] sell-side order failed', cause);
    return null;
  });
  swap.value = { participant: args, token, uid };
  rememberSwap();
  flowStep.value = Step.Swap;
  swapStarting.value = false;
  loadingMessage.value = 'A transação está sendo enviada para a rede.';
};

const buySwapBrz = (args: Participant, token: SwapToken) =>
  buyBrz(token.symbol, parseEther(String(args.offer)));

// The new uid goes back into `swap` too: the card is remounted from it.
const requoteSwap = async () => {
  const pending = swap.value;
  if (!pending) throw new Error('No pending swap');
  const uid = await buySwapBrz(pending.participant, pending.token);
  pending.uid = uid;
  rememberSwap();
  return uid;
};

const keepToken = async (uid: Hex) => {
  if (!swap.value) throw new Error('No pending swap');
  await cancelSwap(uid, swap.value.token.address);
  forgetSwap();
};

const swapFilled = () => {
  // After a failed deposit the status card remounts and reports the same fill
  // again; only "Tentar o depósito" retries then, or a rejection re-prompts forever.
  if (!swap.value || brzReady.value) return;
  brzReady.value = true;
  approveOffer(swap.value.participant);
};

// Resumes an order stored for this chain and account: the status card polls it,
// and a fill that already happened goes straight to the deposit retry.
watch(
  [walletAddress, chainId],
  async ([address, id]) => {
    if (loading.value) return;
    swap.value = undefined;
    brzReady.value = false;
    orderLive.value = false;
    flowStep.value = Step.Sell;
    if (!address) return;
    const stored = loadPendingSellSwap(id, address);
    const token = stored && findSwapToken(user.network.value, stored.symbol);
    if (!stored || !token) return;
    const filled = await Promise.resolve()
      .then(() => getSwapOrder(stored.uid))
      .then((order) => order.status === 'fulfilled')
      .catch(() => false);
    if (
      walletAddress.value !== address ||
      chainId.value !== id ||
      swap.value ||
      loading.value
    )
      return;
    swap.value = {
      participant: stored.participant,
      token,
      uid: stored.uid,
    };
    brzReady.value = filled;
    flowStep.value = Step.Swap;
  },
  { immediate: true },
);
</script>

<template>
  <div>
    <div v-if="flowStep == Step.Sell">
      <AccountLayout selling>
        <template #banner>
          <CustomAlert
            v-if="showAlert"
            :type="'sell'"
            @close-alert="showAlert = false"
          />
          <div v-if="brzReady && swap" class="flex flex-col gap-2 text-white">
            <p class="text-sm">{{ DEPOSIT_RETRY }}</p>
            <button
              type="button"
              class="underline text-sm text-left"
              @click="flowStep = Step.Swap"
            >
              Retomar o depósito
            </button>
          </div>
        </template>
        <SellerComponent v-if="!loading" @approve-tokens="approveOffer">
          <OfferTabs />
          <template #footer><ActivityTab /></template>
        </SellerComponent>
        <LoadingComponent v-else embedded :message="loadingMessage" />
      </AccountLayout>
    </div>
    <div v-if="flowStep == Step.Swap && swap" class="page">
      <div v-if="!loading" class="main-container">
        <!-- Once filled, the token is spent: no "Cotar de novo" or "Ficar com" for it. -->
        <SwapOrderStatus
          v-if="!brzReady"
          :order-uid="swap.uid"
          :token="TokenEnum.BRZ"
          :token-address="brzAddress"
          :keep="swap.token.symbol"
          :requote="requoteSwap"
          :cancel="keepToken"
          @fulfilled="swapFilled"
          @unfilled="forgetSwap"
          @live="orderLive = $event"
        />
        <template v-if="brzReady">
          <p class="text-white text-sm">{{ DEPOSIT_RETRY }}</p>
          <CustomButton
            text="Tentar o depósito"
            @buttonClicked="swap && approveOffer(swap.participant)"
          />
        </template>
        <button
          v-if="brzReady || !orderLive"
          type="button"
          class="text-white underline text-sm"
          @click="flowStep = Step.Sell"
        >
          Voltar
        </button>
      </div>
      <LoadingComponent v-if="loading" :message="loadingMessage" />
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { parseEther, type Hex } from 'viem';

import SellerComponent from '@/components/SellerSteps/SellerComponent.vue';
import AccountLayout from '@/components/SmartAccount/AccountLayout.vue';
import ActivityTab from '@/components/SmartAccount/ActivityTab.vue';
import OfferTabs from '@/components/SmartAccount/OfferTabs.vue';
import SendNetwork from '@/components/SellerSteps/SendNetwork.vue';
import SwapOrderStatus from '@/components/Swap/SwapOrderStatus.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import { useUser } from '@/composables/useUser';
import { approveTokens, addDeposit } from '@/blockchain/sellerMethods';
import { buyBrz, cancelSwap, separatePrompts } from '@/blockchain/swap';
import CustomButton from '@/components/ui/CustomButton.vue';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import { findSwapToken } from '@/model/BuyToken';
import { TokenEnum, type SwapToken } from '@/model/NetworkEnum';
import { promptsNotice } from '@/utils/walletPrompts';
import type { Participant } from '@/utils/bbPay';

enum Step {
  Search,
  Sell,
  Swap,
  Network,
}

const user = useUser();
user.setSellerView(true);

const flowStep = ref<Step>(Step.Sell);
const loading = ref<boolean>(false);
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

const brzAddress = computed(
  () => user.network.value.tokens[TokenEnum.BRZ].address,
);

// Verificar tipagem
const approveOffer = async (args: Participant, paySymbol?: string) => {
  const token = paySymbol
    ? findSwapToken(user.network.value, paySymbol)
    : undefined;
  if (token) return startSwap(args, token);
  loading.value = true;
  try {
    await approveTokens(args);
    flowStep.value = Step.Network;
    loading.value = false;
  } catch (err) {
    console.error(err);
    user.showToast(
      'error',
      brzReady.value ? DEPOSIT_RETRY : 'Não foi possível aprovar.',
    );
    flowStep.value = brzReady.value ? Step.Swap : Step.Sell;
    loading.value = false;
  }
};

/** Buys the offer's BRZ with `token`; the deposit follows once it fills. */
const startSwap = async (args: Participant, token: SwapToken) => {
  brzReady.value = false;
  loading.value = true;
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
  flowStep.value = Step.Swap;
  loading.value = false;
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
  return uid;
};

const keepToken = (uid: Hex) =>
  swap.value
    ? cancelSwap(uid, swap.value.token.address)
    : Promise.reject(new Error('No pending swap'));

const swapFilled = () => {
  // After a failed deposit the status card remounts and reports the same fill
  // again; only "Tentar o depósito" retries then, or a rejection re-prompts forever.
  if (!swap.value || brzReady.value) return;
  brzReady.value = true;
  approveOffer(swap.value.participant);
};

const sendNetwork = async () => {
  loading.value = true;
  try {
    if (user.seller.value) {
      await addDeposit();
      brzReady.value = false;
      flowStep.value = Step.Sell;
      loading.value = false;
      showAlert.value = true;
    }
  } catch (err) {
    console.error(err);
    if (brzReady.value) user.showToast('error', DEPOSIT_RETRY);
    flowStep.value = Step.Network;
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <div v-if="flowStep == Step.Sell">
      <AccountLayout v-if="!loading" selling>
        <SellerComponent @approve-tokens="approveOffer">
          <OfferTabs />
          <template #footer><ActivityTab /></template>
        </SellerComponent>
      </AccountLayout>
      <LoadingComponent v-if="loading" :message="loadingMessage" />
    </div>
    <CustomAlert
      v-if="flowStep == Step.Sell && showAlert"
      :type="'sell'"
      @close-alert="showAlert = false"
    />
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
          v-else-if="!orderLive"
          type="button"
          class="text-white underline text-sm"
          @click="flowStep = Step.Sell"
        >
          Voltar
        </button>
      </div>
      <LoadingComponent v-if="loading" :message="loadingMessage" />
    </div>
    <div v-if="flowStep == Step.Network">
      <SendNetwork
        :sellerId="String(user.sellerId.value)"
        :offer="Number(user.seller.value.offer)"
        :selected-token="user.selectedToken.value"
        v-if="!loading"
        @send-network="sendNetwork"
      />
      <LoadingComponent
        v-if="loading"
        :message="'A transação está sendo enviada para a rede.'"
      />
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}
</style>

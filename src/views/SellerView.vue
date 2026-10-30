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
import { useMutation } from '@tanstack/vue-query';
import { approveTokens } from '@/blockchain/sellerMethods';
import { buyBrz, cancelSwap, separatePrompts } from '@/blockchain/swap';
import { useAddDepositMutation } from '@/queries/mutations';
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

const brzAddress = computed(
  () => user.network.value.tokens[TokenEnum.BRZ].address,
);

const approveMutation = useMutation({ mutationFn: approveTokens });
const addDepositMutation = useAddDepositMutation();
const loading = computed(
  () =>
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
  try {
    await approveMutation.mutateAsync(args);
    flowStep.value = Step.Network;
  } catch (err) {
    console.log(err);
    flowStep.value = Step.Sell;
  }
};

/** Buys the offer's BRZ with `token`; the deposit follows once it fills. */
const startSwap = async (args: Participant, token: SwapToken) => {
  const notice =
    promptsNotice(await separatePrompts(false).catch(() => []), {
      sell: token.symbol,
      buy: TokenEnum.BRZ,
    }) ?? 'A ordem de troca está sendo enviada.';
  // The deposit cannot ride in the order: it needs the BRZ the order delivers.
  loadingMessage.value = `${notice} Quando a troca executar, a carteira ainda pede a aprovação e o depósito do ${TokenEnum.BRZ}.`;
  swapStarting.value = true;
  const uid = await buySwapBrz(args, token).catch((cause) => {
    console.error('[swap] sell-side order failed', cause);
    return null;
  });
  swap.value = { participant: args, token, uid };
  flowStep.value = Step.Swap;
  swapStarting.value = false;
  loadingMessage.value = 'A transação está sendo enviada para a rede.';
};

const buySwapBrz = (args: Participant, token: SwapToken) =>
  buyBrz(token.symbol, parseEther(String(args.offer)));

const requoteSwap = () =>
  swap.value
    ? buySwapBrz(swap.value.participant, swap.value.token)
    : Promise.reject(new Error('No pending swap'));

const keepToken = (uid: Hex) =>
  swap.value
    ? cancelSwap(uid, swap.value.token.address)
    : Promise.reject(new Error('No pending swap'));

const swapFilled = () => {
  if (swap.value) approveOffer(swap.value.participant);
};

const sendNetwork = async () => {
  try {
    await addDepositMutation.mutateAsync();
    flowStep.value = Step.Sell;
    showAlert.value = true;
  } catch (err) {
    console.log(err);
    flowStep.value = Step.Network;
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
        <SwapOrderStatus
          :order-uid="swap.uid"
          :token="TokenEnum.BRZ"
          :token-address="brzAddress"
          :keep="swap.token.symbol"
          :requote="requoteSwap"
          :cancel="keepToken"
          @fulfilled="swapFilled"
        />
        <button
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

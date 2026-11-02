<script setup lang="ts">
import { computed, ref } from 'vue';

import SellerComponent from '@/components/SellerSteps/SellerComponent.vue';
import AccountLayout from '@/components/SmartAccount/AccountLayout.vue';
import ActivityTab from '@/components/SmartAccount/ActivityTab.vue';
import OfferTabs from '@/components/SmartAccount/OfferTabs.vue';
import SendNetwork from '@/components/SellerSteps/SendNetwork.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import { useUser } from '@/composables/useUser';
import { useMutation } from '@tanstack/vue-query';
import { approveTokens } from '@/blockchain/sellerMethods';
import { useAddDepositMutation } from '@/queries/mutations';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import type { Participant } from '@/utils/bbPay';

enum Step {
  Search,
  Sell,
  Network,
}

const user = useUser();
user.setSellerView(true);

const flowStep = ref<Step>(Step.Sell);
const showAlert = ref<boolean>(false);

const approveMutation = useMutation({ mutationFn: approveTokens });
const addDepositMutation = useAddDepositMutation();
const loading = computed(
  () => approveMutation.isPending.value || addDepositMutation.isPending.value,
);

// Verificar tipagem
const approveOffer = async (args: Participant) => {
  try {
    await approveMutation.mutateAsync(args);
    flowStep.value = Step.Network;
  } catch (err) {
    console.log(err);
    flowStep.value = Step.Sell;
  }
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
      <LoadingComponent
        v-if="loading"
        :message="'A transação está sendo enviada para a rede.'"
      />
    </div>
    <CustomAlert
      v-if="flowStep == Step.Sell && showAlert"
      :type="'sell'"
      @close-alert="showAlert = false"
    />
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

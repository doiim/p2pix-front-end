<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { storeToRefs } from "pinia";

import SellerComponent from "@/components/SellerSteps/SellerComponent.vue";
import SearchComponent from "@/components/SearchComponent.vue";
import SendNetwork from "@/components/SellerSteps/SendNetwork.vue";
import SellerSearchComponent from "@/components/SellerSteps/SellerSearchComponent.vue";
import LoadingComponent from "@/components/LoadingComponent/LoadingComponent.vue";
import { useViemStore } from "@/store/viem";
import { approveTokens, addDeposit } from "@/blockchain/sellerMethods";

import CustomAlert from "@/components/CustomAlert/CustomAlert.vue";
import type { Participant } from "@/utils/bbPay";

enum Step {
  Search,
  Sell,
  Network,
}

const viemStore = useViemStore();
viemStore.setSellerView(true);

const flowStep = ref<Step>(Step.Sell);
const loading = ref<boolean>(false);

const showAlert = ref<boolean>(false);

// Verificar tipagem
const approveOffer = async (args: Participant) => {
  loading.value = true;
  try {
    await approveTokens(args);
    flowStep.value = Step.Network;
    loading.value = false;
  } catch (err) {
    console.log(err);
    flowStep.value = Step.Sell;
    loading.value = false;
  }
};

const sendNetwork = async () => {
  loading.value = true;
  try {
    if (viemStore.seller) {
      await addDeposit();
      flowStep.value = Step.Sell;
      loading.value = false;
      showAlert.value = true;
    }
  } catch (err) {
    console.log(err);
    flowStep.value = Step.Network;
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <div v-if="flowStep == Step.Sell">
      <SellerComponent v-if="!loading" @approve-tokens="approveOffer" />
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
        :sellerId="viemStore.sellerId"
        :offer="Number(viemStore.seller.offer)"
        :selected-token="viemStore.selectedToken"
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

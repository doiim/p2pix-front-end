<script setup lang="ts">
import SellerComponent from "@/components/SellerSteps/SellerComponent.vue";
import SendNetwork from "@/components/SellerSteps/SendNetwork.vue";
import LoadingComponent from "@/components/LoadingComponent/LoadingComponent.vue";
import { approveTokens, addDeposit } from "@/blockchain/sellerMethods";

import { ref } from "vue";
import { useEtherStore } from "@/store/ether";
import CustomAlert from "@/components/CustomAlert/CustomAlert.vue";

enum Step {
  Search,
  Sell,
  Network,
}

interface SellerData {
  identification: string;
  account: string;
  branch: string;
  bankIspb: string;
  accountType: string;
  savingsVariation: string;
}

const etherStore = useEtherStore();
etherStore.setSellerView(true);

const flowStep = ref<Step>(Step.Sell);
const loading = ref<boolean>(false);

const offerValue = ref<string>("");
const showAlert = ref<boolean>(false);

// Verificar tipagem
const approveOffer = async (args: {
  offer: string;
  postProcessedPixKey: string;
}) => {
  loading.value = true;
  try {
    offerValue.value = args.offer;
    await approveTokens(args.offer);
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
    if (offerValue.value) {
      await addDeposit(String(offerValue.value));
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
        :pixKey="pixKeyBuyer"
        :offer="Number(offerValue)"
        :selected-token="etherStore.selectedToken"
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

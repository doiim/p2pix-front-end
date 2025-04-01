<script setup lang="ts">
import { ref, computed, watch, onMounted, watchEffect } from "vue";
import { useOnboard } from "@web3-onboard/vue";
import { Networks } from "../model/Networks";
import { NetworkEnum } from "../model/NetworkEnum";
import type { PropType } from "vue";
import { useUser } from "@/composables/useUser";

const props = defineProps({
  targetNetwork: {
    type: Object as PropType<NetworkEnum>,
    default: NetworkEnum.sepolia,
  },
});

const { connectedWallet } = useOnboard();
const user = useUser();
const { networkName } = user;

const isWrongNetwork = ref(false);
const currentNetworkName = ref("");
const targetNetworkName = computed(
  () => Networks[props.targetNetwork as keyof typeof Networks].chainName
);

const checkNetwork = () => {
  if (connectedWallet.value) {
    const chainId = connectedWallet.value.chains[0].id;
    const targetChainId =
      Networks[props.targetNetwork as keyof typeof Networks].chainId;

    isWrongNetwork.value =
      chainId.toLowerCase() !== targetChainId.toLowerCase();

    // Find current network name
    Object.entries(Networks).forEach(([key, network]) => {
      if (network.chainId === chainId) {
        currentNetworkName.value = network.chainName;
      }
    });
  } else {
    isWrongNetwork.value = false; // No wallet connected yet
  }
};

const switchNetwork = async () => {
  try {
    if (connectedWallet.value && connectedWallet.value.provider) {
      const targetChainId =
        Networks[props.targetNetwork as keyof typeof Networks].chainId;
      await connectedWallet.value.provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainId }],
      });
    }
  } catch (error) {
    console.error("Failed to switch network:", error);
  }
};

onMounted(checkNetwork);
watch(connectedWallet, checkNetwork, { immediate: true });
watch(networkName, checkNetwork, { immediate: true });
</script>

<template>
  <transition name="slide-up" appear>
    <div
      v-if="isWrongNetwork"
      class="fixed bottom-0 left-0 right-0 bg-red-500 text-white p-4 flex justify-between items-center z-50"
    >
      <div>
        <span class="font-bold">Wrong network!</span>
        <span v-if="currentNetworkName"
          >You are connected to {{ currentNetworkName }}.</span
        >
        <span> Please switch to {{ targetNetworkName }}.</span>
      </div>
      <button
        @click="switchNetwork"
        class="bg-white text-red-500 px-4 py-2 rounded font-bold hover:bg-gray-100 transition-colors"
      >
        Switch Network
      </button>
    </div>
  </transition>
</template>

<style scoped>
.slide-up-enter-active,
.slide-up-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}

.slide-up-enter-from,
.slide-up-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.slide-up-enter-to,
.slide-up-leave-from {
  transform: translateY(0);
  opacity: 1;
}
</style>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from "vue";
import { useOnboard } from "@web3-onboard/vue";
import { Networks } from "@/config/networks";
import { useUser } from "@/composables/useUser";

const { connectedWallet } = useOnboard();
const user = useUser();
const { network } = user;

const isWrongNetwork = ref(false);
const targetNetworkName = computed(() => network.value.name);

const checkNetwork = () => {
  if (connectedWallet.value) {
    const chainId = connectedWallet.value.chains[0].id;
    isWrongNetwork.value = Number(chainId) !== network.value.id;
  } else {
    isWrongNetwork.value = false; // No wallet connected yet
  }
};

const switchNetwork = async () => {
  try {
    if (connectedWallet.value && connectedWallet.value.provider) {
      let chainId = network.value.id.toString(16);
      await connectedWallet.value.provider.request({
        method: "wallet_switchEthereumChain",
        params: [
          {
            chainId: `0x${chainId}`,
          },
        ],
      });
    }
  } catch (error) {
    console.error("Failed to switch network:", error);
  }
};

onMounted(checkNetwork);
watch(connectedWallet, checkNetwork);
watch(network, checkNetwork, { immediate: true });
</script>

<template>
  <transition name="slide-up" appear>
    <div
      v-if="isWrongNetwork"
      class="fixed bottom-0 left-0 right-0 bg-red-500 text-white p-4 flex justify-between items-center z-50"
    >
      <div>
        <span class="font-bold">Wrong network!</span>
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

<script setup lang="ts">
import { useRoute } from "vue-router";
import TopBar from "@/components/TopBar/TopBar.vue";
import SpinnerComponent from "@/components/ui/SpinnerComponent.vue";
import ToasterComponent from "@/components/ui/ToasterComponent.vue";
import { init, useOnboard } from "@web3-onboard/vue";
import injectedModule from "@web3-onboard/injected-wallets";
import { Networks, DEFAULT_NETWORK } from "@/config/networks";
import { ref } from "vue";

const route = useRoute();
const injected = injectedModule();
const targetNetwork = ref(DEFAULT_NETWORK);

const web3Onboard = init({
  wallets: [injected],
  chains: Object.entries(Networks).map(([, network]) => ({
    id: network.id,
    label: network.nativeCurrency.symbol,
    rpcUrl: network.rpcUrls.default.http[0],
  })),
  connect: {
    autoConnectLastWallet: true,
  },
});

const { connectedWallet } = useOnboard();
if (!connectedWallet) {
  web3Onboard.connectWallet();
}
</script>

<template>
  <div class="p-3 sm:p-4 md:p-8">
    <TopBar />
    <RouterView v-slot="{ Component }">
      <template v-if="Component">
        <Transition name="page" mode="out-in" appear>
          <div :key="route.fullPath">
            <Suspense>
              <template #default>
                <component :is="Component" />
              </template>
              <template #fallback>
                <div class="flex w-full h-full justify-center items-center">
                  <SpinnerComponent :width="'16'" :height="'16'" />
                </div>
              </template>
            </Suspense>
          </div>
        </Transition>
      </template>
    </RouterView>
    <ToasterComponent :targetNetwork="targetNetwork" />
  </div>
</template>

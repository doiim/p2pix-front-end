<script setup lang="ts">
import { useRoute } from "vue-router";
import TopBar from "@/components/TopBar/TopBar.vue";
import SpinnerComponent from "@/components/SpinnerComponent.vue";
import { init, useOnboard } from "@web3-onboard/vue";
import injectedModule from "@web3-onboard/injected-wallets";
import { Networks } from "./model/Networks";
import { NetworkEnum } from "./model/NetworkEnum";

const route = useRoute();
const injected = injectedModule();

const web3Onboard = init({
  wallets: [injected],
  chains: [
    {
      id: Networks[NetworkEnum.sepolia].chainId,
      token: "ETH",
      label: "Sepolia",
      rpcUrl: import.meta.env.VITE_SEPOLIA_API_URL,
    },
    {
      id: Networks[NetworkEnum.rootstock].chainId,
      token: "tRBTC",
      label: "Rootstock Testnet",
      rpcUrl: import.meta.env.VITE_ROOTSTOCK_API_URL,
    },
  ],
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
  </div>
</template>

<script setup lang="ts">
import TopBar from "@/components/TopBar/TopBar.vue";
import SpinnerComponent from "@/components/SpinnerComponent.vue";
import { init, useOnboard } from "@web3-onboard/vue";
import injectedModule from "@web3-onboard/injected-wallets";
import { Networks } from "./model/Networks";
import { NetworkEnum } from "./model/NetworkEnum";

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
  <TopBar />
  <RouterView v-slot="{ Component }">
    <template v-if="Component">
      <Suspense>
        <component :is="Component"></component>
        <template #fallback>
          <appkit-button />
          <div class="flex w-full h-full justify-center items-center">
            <SpinnerComponent :width="'16'" :height="'16'"></SpinnerComponent>
          </div>
        </template>
      </Suspense>
    </template>
  </RouterView>
</template>

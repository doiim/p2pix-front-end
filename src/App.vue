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

const currentYear = new Date().getFullYear();
const appVersion = __APP_VERSION__;

const web3Onboard = init({
  wallets: [injected],
  chains: Object.values(Networks).map((network) => ({
    id: network.id,
    token: network.nativeCurrency.symbol,
    label: network.name,
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
  <main class="p-3 sm:p-4 md:p-8">
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
  </main>
  <footer class="mt-20 pt-2 pb-2 border-t border-gray-700 text-center">
    <div class="flex justify-center items-center">
      <p class="text-gray-400 text-xs"> Versão: {{ appVersion }} | © {{ currentYear }} P2Pix. Todos os direitos reservados.</p>
    </div>
  </footer>
</template>

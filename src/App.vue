<script setup lang="ts">
import TopBar from "@/components/TopBar/TopBar.vue";
import SpinnerComponent from "@/components/SpinnerComponent.vue";

// import { createAppKit, useAppKit } from "@reown/appkit/vue";
// import { EthersAdapter } from "@reown/appkit-adapter-ethers";
// import { sepolia, rootstockTestnet } from "@reown/appkit/networks";

// // 1. Get projectId from https://cloud.reown.com
// const projectId = "8149aee0a01eeaf7daaf2d326d074b30";

// // 2. Create your application's metadata object
// const metadata = {
//   name: "p2pix",
//   description:
//     "Uma plataforma descentralizada para transações de criptomoedas ponto-a-ponto usando PIX",
//   url: "https://p2pix.doiim.com", // origin must match your domain & subdomain
//   icons: ["https://assets.reown.com/reown-profile-pic.png"],
// };

// // 3. Create a AppKit instance
// createAppKit({
//   adapters: [new EthersAdapter()],
//   networks: [sepolia, rootstockTestnet],
//   metadata,
//   projectId,
//   features: {
//     analytics: true, // Optional - defaults to your Cloud configuration
//   },
// });
// // 4. Use modal composable
// const modal = useAppKit();
</script>

<template>
  <TopBar :modal="modal" />
  <RouterView v-slot="{ Component }">
    <template v-if="Component">
      <Suspense>
        <component :is="Component"></component>
        <template #fallback>
          <div class="flex w-full h-full justify-center items-center">
            <SpinnerComponent :width="'16'" :height="'16'"></SpinnerComponent>
          </div>
        </template>
      </Suspense>
    </template>
  </RouterView>
</template>

import { createApp } from "vue";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";
import { WagmiPlugin } from "@wagmi/vue";
import App from "./App.vue";
import router from "./router";
import { wagmiConfig } from "./config/wagmi";

import "./assets/main.css";
import "./assets/transitions.css";

const app = createApp(App);
app.use(WagmiPlugin, { config: wagmiConfig });
app.use(VueQueryPlugin, { 
  queryClient: new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }),
});
app.use(router);
app.mount("#app");

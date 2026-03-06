import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { QueryClient, VueQueryPlugin } from "@tanstack/vue-query";

import "./assets/main.css";
import "./assets/transitions.css";
import { WagmiPlugin } from "@wagmi/vue";
import { getWagmiConfig } from "./config/wagmi";

const app = createApp(App);

app.use(WagmiPlugin, { config: getWagmiConfig() });
app.use(VueQueryPlugin, { 
  queryClient: new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
      },
    },
  }),
})
app.use(router);

app.mount("#app");

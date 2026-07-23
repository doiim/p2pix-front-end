import { createApp } from 'vue';
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { WagmiPlugin } from '@wagmi/vue';

import App from './App.vue';
import router from './router';
import { env } from './config/env';
import { setupAppKit } from './config/appkit';

import './assets/main.css';
import './assets/transitions.css';

const adapter = setupAppKit(env);

const app = createApp(App);
app.use(WagmiPlugin, { config: adapter.wagmiConfig });
app.use(VueQueryPlugin, {
  queryClient: new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false } },
  }),
});
app.use(router);
app.mount('#app');

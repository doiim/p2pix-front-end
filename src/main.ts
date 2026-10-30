import { createApp } from 'vue';
import { VueQueryPlugin } from '@tanstack/vue-query';
import { WagmiPlugin } from '@wagmi/vue';

import App from './App.vue';
import router from './router';
import { wagmiConfig } from './wallet/wagmi';
import { queryClient } from './queries/client';

import './assets/main.css';
import './assets/transitions.css';

const app = createApp(App);
app.use(WagmiPlugin, { config: wagmiConfig });
app.use(VueQueryPlugin, { queryClient });
app.use(router);
app.mount('#app');

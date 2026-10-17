<script setup lang="ts">
import { ref } from 'vue';
import router from '@/router/index';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import {
  useAccountRouter,
  useCopyAddress,
} from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { useUser } from '@/composables/useUser';
import { useWalletDisconnect } from '@/config/appkit';
import { resetAaAccountCache } from '@/blockchain/aa/operations';
import { TokenEnum } from '@/model/NetworkEnum';
import { formatTokenAmount } from '@/utils/formatTokenAmount';
import { getNetworkImage } from '@/utils/imagesPath';
import CustomButton from '@/components/ui/CustomButton.vue';
import FormCard from '@/components/ui/FormCard.vue';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import DropdownChip from './DropdownChip.vue';
import TokensTab from './TokensTab.vue';
import ActivityTab from './ActivityTab.vue';

const TABS = ['Tokens', 'Atividade'] as const;

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const copyAddress = useCopyAddress();
const form = useSendForm();
const user = useUser();
const { disconnect } = useWalletDisconnect();

const tab = ref(0);

const shortAddress = () => {
  const a = account.smartAccountAddress.value ?? '';
  return `${a.slice(0, 4)}…${a.slice(-6)}`;
};

const handleDisconnect = async () => {
  resetAaAccountCache();
  user.setWalletAddress(null);
  await disconnect();
  form.reset();
  accountRouter.reset();
  router.push({ name: 'home' });
};
</script>

<template>
  <FormCard no-border>
    <div class="flex items-center justify-between gap-4">
      <div v-if="account.balancesLoaded.value">
        <p class="acct-label">Saldo da conta</p>
        <p
          v-for="token in TokenEnum"
          :key="token"
          class="text-xl font-semibold text-gray-900"
        >
          {{
            formatTokenAmount(
              account.balanceOf(token),
              account.decimalsOf(token),
            )
          }}
          {{ token }}
        </p>
        <p class="text-xs text-gray-400">
          {{ formatTokenAmount(account.balanceOf(), account.decimalsOf()) }}
          {{ account.symbolOf() }}
        </p>
      </div>
      <div v-else-if="account.error.value">
        <p class="acct-label">Saldo da conta</p>
        <p class="text-sm text-red-500">{{ account.error.value }}</p>
      </div>
      <SpinnerComponent v-else width="6" height="6" />
      <DropdownChip label="Opções do endereço">
        <img
          :src="getNetworkImage(user.network.value.name)"
          :alt="user.network.value.name"
          class="h-5 w-5"
        />
        <span class="text-sm font-medium text-gray-900">
          {{ shortAddress() }}
        </span>
        <template #items="{ close }">
          <button
            type="button"
            class="menu-item"
            @click="(close(), copyAddress())"
          >
            Copiar endereço
          </button>
          <button
            type="button"
            class="menu-item text-red-500!"
            @click="(close(), handleDisconnect())"
          >
            Desconectar
          </button>
        </template>
      </DropdownChip>
    </div>

    <div class="mt-5 grid grid-cols-2 gap-3">
      <CustomButton
        text="Enviar"
        size="lg"
        @button-clicked="accountRouter.push('send')"
      />
      <CustomButton
        text="Receber"
        variant="outline"
        size="lg"
        @button-clicked="accountRouter.push('receive')"
      />
    </div>
  </FormCard>

  <FormCard no-border>
    <div class="tabs">
      <button
        v-for="(name, index) in TABS"
        :key="name"
        type="button"
        class="tab"
        :class="{ 'is-active': tab === index }"
        :aria-pressed="tab === index"
        @click="tab = index"
      >
        {{ name }}
      </button>
    </div>
    <TokensTab v-if="tab === 0" />
    <ActivityTab v-else />
  </FormCard>
</template>

<style scoped>
@reference "tailwindcss";

.tabs {
  @apply mb-3 flex gap-6 border-b border-gray-300;
}

.tab {
  @apply -mb-px border-b-2 border-transparent pb-2 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900 cursor-pointer;
}

.tab.is-active {
  @apply border-amber-400 font-semibold text-gray-900;
}
</style>

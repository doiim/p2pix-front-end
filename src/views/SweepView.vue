<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import { useAccountRouter } from '@/composables/account/useAccountRouter';
import { useSendForm } from '@/composables/account/useSendForm';
import { useUser } from '@/composables/useUser';
import { getCurrentAccount } from '@/blockchain/provider';
import AccountCard from '@/components/SmartAccount/AccountCard.vue';
import router from '@/router/index';

const account = usePasskeyAccount();
const accountRouter = useAccountRouter();
const form = useSendForm();
const user = useUser();
const { showToast } = user;

const load = async () => {
  account.reset();
  form.reset();
  accountRouter.reset();
  await account.refreshBalances();
  if (account.error.value) showToast('error', account.error.value);
};

onMounted(() => {
  if (!getCurrentAccount().address) {
    router.push({ name: 'home' });
    return;
  }
  void load();
});

// TopBar owns network switching and disconnect; follow both.
watch(
  () => user.network.value.id,
  () => void load(),
);
watch(user.walletAddress, (address) => {
  if (!address) router.push({ name: 'home' });
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold sm:text-5xl text-3xl">Sua conta</span>
      <span class="text font-medium sm:text-base text-sm max-w-[28rem]">
        Veja seu saldo, receba e envie tokens da sua conta inteligente
      </span>
    </div>

    <div v-if="!account.isReady.value" class="main-container max-w-md">
      <p class="text-gray-400 text-sm text-center">
        Conta inteligente indisponível para esta carteira ou rede.
      </p>
    </div>
    <AccountCard v-else />
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.page {
  @apply flex flex-col items-center justify-center w-full mt-16 mb-8 px-4;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.text {
  @apply text-white text-center;
}
</style>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUser } from '@/composables/useUser';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import CustomButton from '@/components/ui/CustomButton.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import router from '@/router/index';
import type { Address } from 'viem';

const user = useUser();
const { walletAddress } = user;

const passkey = usePasskeyAccount();
const {
  busy,
  error,
  lastUserOpHash,
  balances,
  ethBalance,
  smartAccountAddress,
  isReady,
  sweep,
  refreshBalances,
} = passkey;

const sweepRecipient = ref('');
const tokenList = ref('');
const showAlert = ref(false);
const alertMessage = ref('');
const alertType = ref<'success' | 'error'>('success');

const parseTokenList = (): Address[] =>
  tokenList.value
    .split(/[\n,]+/)
    .map((address) => address.trim())
    .filter(Boolean) as Address[];

const notify = (type: 'success' | 'error', message: string) => {
  alertMessage.value = message;
  alertType.value = type;
  showAlert.value = true;
};

onMounted(() => {
  if (!walletAddress.value) {
    router.push({ name: 'home' });
    return;
  }
});

const handleSweep = async () => {
  const recipient = sweepRecipient.value.trim() as Address;
  const addresses = parseTokenList();

  if (!recipient || addresses.length === 0) {
    notify(
      'error',
      'Informe um endereço de destino e pelo menos um endereço de token.',
    );
    return;
  }

  const result = await sweep(addresses, recipient);
  if (result) {
    notify(
      'success',
      `Varredura enviada! userOpHash: ${result.userOpHash.slice(0, 10)}...`,
    );
  } else {
    notify('error', error.value ?? 'Falha ao varrer');
  }
};

const handleRefreshBalances = async () => {
  const addresses = parseTokenList();
  if (addresses.length > 0) {
    await refreshBalances(addresses);
  }
};
</script>

<template>
  <div class="page">
    <LoadingComponent
      v-if="busy"
      :message="'A transação está sendo enviada para a rede'"
    />

    <template v-else>
      <div class="text-container">
        <span class="text font-bold text-3xl leading-9">Conta Passkey</span>
      </div>

      <template v-if="!isReady">
        <div class="main-container max-w-md">
          <p class="text-gray-400 text-sm text-center">
            Os recursos da conta Kernel não estão configurados. Defina
            VITE_PIMLICO_API_KEY ou um bundler por chain; no ambiente local,
            execute scripts/dev-local.sh para iniciar Alto.
          </p>
        </div>
      </template>

      <template v-else>
        <div
          v-if="smartAccountAddress"
          class="text-sm text-gray-400 break-all text-center mb-4"
        >
          {{ smartAccountAddress }}
        </div>

        <div class="main-container max-w-md">
          <div
            v-if="showAlert"
            class="p-4 rounded text-sm w-full"
            :class="
              alertType === 'success'
                ? 'bg-green-900/50 text-green-300'
                : 'bg-red-900/50 text-red-300'
            "
          >
            {{ alertMessage }}
          </div>

          <div class="flex flex-col gap-4 w-full">
            <div
              class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg"
            >
              <input
                v-model="sweepRecipient"
                type="text"
                placeholder="Endereço de destino (0x...)"
                class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
              />
            </div>
            <div class="flex flex-col w-full gap-1">
              <div
                class="flex flex-col w-full bg-white sm:px-10 px-6 py-4 rounded-lg"
              >
                <textarea
                  v-model="tokenList"
                  rows="4"
                  placeholder="Endereços dos tokens (0x...)&#10;0x..."
                  class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full resize-y"
                />
              </div>
              <p class="text-xs text-gray-400">
                Um endereço por linha ou separados por vírgula. ETH é sempre
                varrido.
              </p>
            </div>
            <div class="flex gap-2">
              <CustomButton
                text="Atualizar saldos"
                variant="outline"
                :loading="busy"
                @button-clicked="handleRefreshBalances"
              />
              <CustomButton
                text="Varrer tudo"
                :loading="busy"
                @button-clicked="handleSweep"
              />
            </div>
            <div v-if="balances.length > 0 || ethBalance > 0n" class="w-full">
              <p class="text-sm font-semibold mb-2 text-white">Saldos</p>
              <div class="text-sm text-gray-300">
                <p>ETH: {{ ethBalance.toString() }}</p>
                <p v-for="b in balances" :key="b.address" class="truncate">
                  {{ b.address.slice(0, 10) }}...:
                  {{ b.balance.toString() }} (decimais: {{ b.decimals }})
                </p>
              </div>
            </div>
            <div v-if="lastUserOpHash" class="text-xs text-green-400 break-all">
              Último userOpHash: {{ lastUserOpHash }}
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.page {
  @apply flex flex-col items-center justify-center w-full mt-16 mb-8;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4 mb-4;
}

.text {
  @apply text-white text-center;
}
</style>

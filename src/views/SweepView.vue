<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useUser } from '@/composables/useUser';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
import CustomButton from '@/components/ui/CustomButton.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import router from '@/router/index';
import type { Address } from 'viem';
import { env } from '@/config/env';

const user = useUser();
const { walletAddress } = user;

const passkey = usePasskeyAccount();
const {
  busy,
  error,
  lastUserOpHash,
  owners,
  ownersPublicKeys,
  balances,
  ethBalance,
  smartAccountAddress,
  isReady,
  sweep,
  addRecoveryOwner,
  refreshBalances,
  refreshOwners,
} = passkey;

const activeTab = ref<'sweep' | 'recovery'>('sweep');
const sweepRecipient = ref('');
const tokenList = ref('');
const recoveryEoa = ref('');
const showAlert = ref(false);
const alertMessage = ref('');
const alertType = ref<'success' | 'error'>('success');

onMounted(async () => {
  if (!walletAddress.value) {
    router.push({ name: 'home' });
    return;
  }
  if (isReady) {
    await refreshOwners();
  }
});

const handleSweep = async () => {
  const recipient = sweepRecipient.value.trim() as Address;
  const addresses = tokenList.value
    .split(/[\n,]+/)
    .map((a) => a.trim())
    .filter(Boolean) as Address[];

  if (!recipient || addresses.length === 0) {
    alertMessage.value =
      'Informe um endereço de destino e pelo menos um endereço de token.';
    alertType.value = 'error';
    showAlert.value = true;
    return;
  }

  const result = await sweep(addresses, recipient);
  if (result) {
    alertMessage.value = `Varredura enviada! userOpHash: ${result.userOpHash.slice(0, 10)}...`;
    alertType.value = 'success';
    showAlert.value = true;
  } else {
    alertMessage.value = error.value ?? 'Falha ao varrer';
    alertType.value = 'error';
    showAlert.value = true;
  }
};

const handleAddOwner = async () => {
  const eoa = recoveryEoa.value.trim() as Address;
  if (!eoa || !eoa.startsWith('0x')) {
    alertMessage.value = 'Informe um endereço EOA válido (0x...)';
    alertType.value = 'error';
    showAlert.value = true;
    return;
  }

  const hash = await addRecoveryOwner(eoa);
  if (hash) {
    alertMessage.value = `Proprietário de recuperação adicionado! userOpHash: ${hash.slice(0, 10)}...`;
    alertType.value = 'success';
    showAlert.value = true;
    recoveryEoa.value = '';
    await refreshOwners();
  } else {
    alertMessage.value = error.value ?? 'Falha ao adicionar proprietário';
    alertType.value = 'error';
    showAlert.value = true;
  }
};

const handleRefreshBalances = async () => {
  const addresses = tokenList.value
    .split(/[\n,]+/)
    .map((a) => a.trim())
    .filter(Boolean) as Address[];
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
            <template v-if="env.passkey.accountKind === 'kernel'">
              Os recursos da conta passkey não estão configurados. Defina
              VITE_PIMLICO_API_KEY (ou VITE_BUNDLER_URL) em .env.local.
            </template>
            <template v-else>
              Os recursos da conta passkey não estão configurados. Defina
              VITE_WEBAUTHN_PLUGIN_ADDRESS, VITE_FACTORY_ADDRESS,
              VITE_ENTRYPOINT_ADDRESS e VITE_PIMLICO_API_KEY (ou
              VITE_BUNDLER_URL) em .env.local. Como alternativa, defina
              VITE_ACCOUNT_KIND=kernel para usar uma smart account Kernel, que
              precisa apenas da chave Pimlico.
            </template>
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
          <div class="flex gap-4 mb-4">
            <button
              class="tab-button"
              :class="{ active: activeTab === 'sweep' }"
              @click="activeTab = 'sweep'"
            >
              Varrer
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'recovery' }"
              @click="activeTab = 'recovery'"
            >
              Recuperação
            </button>
          </div>

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

          <!-- Aba Varrer -->
          <div v-if="activeTab === 'sweep'" class="flex flex-col gap-4 w-full">
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

          <!-- Aba Recuperação -->
          <div
            v-if="activeTab === 'recovery'"
            class="flex flex-col gap-4 w-full"
          >
            <div class="flex gap-2 w-full">
              <div
                class="flex flex-col flex-1 bg-white sm:px-10 px-6 py-4 rounded-lg"
              >
                <input
                  v-model="recoveryEoa"
                  type="text"
                  placeholder="Adicionar EOA de recuperação (0x...)"
                  class="border-none outline-none sm:text-lg text-sm text-gray-900 w-full"
                />
              </div>
              <CustomButton
                text="Adicionar proprietário"
                :full-width="false"
                :loading="busy"
                @button-clicked="handleAddOwner"
              />
            </div>
            <div v-if="lastUserOpHash" class="text-xs text-green-400 break-all">
              Último userOpHash: {{ lastUserOpHash }}
            </div>
            <div class="w-full">
              <p class="text-sm font-semibold mb-2 text-white">
                Proprietários atuais
              </p>
              <div
                v-if="owners.length === 0 && ownersPublicKeys.length === 0"
                class="text-sm text-gray-400"
              >
                Nenhum proprietário EOA listado. Os proprietários passkey são
                gerenciados pelo plugin.
              </div>
              <div
                v-if="owners.length > 0"
                class="text-sm text-gray-300 space-y-1"
              >
                <p class="text-xs text-gray-400 mb-1">Proprietários EOA:</p>
                <p v-for="(owner, i) in owners" :key="i" class="break-all">
                  {{ owner }}
                </p>
              </div>
              <div
                v-if="ownersPublicKeys.length > 0"
                class="text-sm text-gray-300 space-y-1 mt-2"
              >
                <p class="text-xs text-gray-400 mb-1">Proprietários Passkey:</p>
                <p
                  v-for="(pk, i) in ownersPublicKeys"
                  :key="i"
                  class="break-all"
                >
                  x: {{ pk.x.toString() }}, y: {{ pk.y.toString() }}
                </p>
              </div>
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

.tab-button {
  @apply px-4 py-2 rounded-lg text-gray-300 font-semibold text-sm transition-colors border-2 border-gray-500 cursor-pointer;
}

.tab-button:hover {
  @apply bg-white/5;
}

.tab-button.active {
  @apply text-white border-amber-300 bg-amber-300/10;
}
</style>

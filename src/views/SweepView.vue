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
      'Enter a destination address and at least one token address.';
    alertType.value = 'error';
    showAlert.value = true;
    return;
  }

  const result = await sweep(addresses, recipient);
  if (result) {
    alertMessage.value = `Sweep submitted! userOpHash: ${result.userOpHash.slice(0, 10)}...`;
    alertType.value = 'success';
    showAlert.value = true;
  } else {
    alertMessage.value = error.value ?? 'Sweep failed';
    alertType.value = 'error';
    showAlert.value = true;
  }
};

const handleAddOwner = async () => {
  const eoa = recoveryEoa.value.trim() as Address;
  if (!eoa || !eoa.startsWith('0x')) {
    alertMessage.value = 'Enter a valid EOA address (0x...)';
    alertType.value = 'error';
    showAlert.value = true;
    return;
  }

  const hash = await addRecoveryOwner(eoa);
  if (hash) {
    alertMessage.value = `Recovery owner added! userOpHash: ${hash.slice(0, 10)}...`;
    alertType.value = 'success';
    showAlert.value = true;
    recoveryEoa.value = '';
    await refreshOwners();
  } else {
    alertMessage.value = error.value ?? 'Add owner failed';
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
        <span class="text font-bold text-2xl">Passkey Account</span>
      </div>

      <template v-if="!isReady">
        <div class="main-container max-w-md">
          <p class="text-gray-400 text-sm text-center">
            <template v-if="env.passkey.accountKind === 'kernel'">
              Passkey account features are not configured. Set
              VITE_PIMLICO_API_KEY (or VITE_BUNDLER_URL) in .env.local.
            </template>
            <template v-else>
              Passkey account features are not configured. Set
              VITE_WEBAUTHN_PLUGIN_ADDRESS, VITE_FACTORY_ADDRESS,
              VITE_ENTRYPOINT_ADDRESS, and VITE_PIMLICO_API_KEY (or
              VITE_BUNDLER_URL) in .env.local. Alternatively, set
              VITE_ACCOUNT_KIND=kernel to use a Kernel smart account instead,
              which only needs the Pimlico key.
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
              Sweep
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'recovery' }"
              @click="activeTab = 'recovery'"
            >
              Recovery
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

          <!-- Sweep Tab -->
          <div v-if="activeTab === 'sweep'" class="flex flex-col gap-4 w-full">
            <div>
              <label class="block text-sm font-semibold mb-1 text-gray-900"
                >Destination Address</label
              >
              <input
                v-model="sweepRecipient"
                type="text"
                placeholder="0x..."
                class="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-sm font-semibold mb-1 text-gray-900"
                >Token Addresses</label
              >
              <textarea
                v-model="tokenList"
                rows="4"
                placeholder="0x...&#10;0x..."
                class="w-full px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:border-amber-500 focus:outline-none"
              />
              <p class="text-xs text-gray-400 mt-1">
                One address per line, or comma-separated. ETH is always swept.
              </p>
            </div>
            <div class="flex gap-2">
              <CustomButton
                text="Refresh Balances"
                :loading="busy"
                @button-clicked="handleRefreshBalances"
              />
              <CustomButton
                text="Sweep All"
                :loading="busy"
                @button-clicked="handleSweep"
              />
            </div>
            <div v-if="balances.length > 0 || ethBalance > 0n">
              <p class="text-sm font-semibold mb-2 text-gray-900">Balances</p>
              <div class="text-sm text-gray-600">
                <p>ETH: {{ ethBalance.toString() }}</p>
                <p v-for="b in balances" :key="b.address" class="truncate">
                  {{ b.address.slice(0, 10) }}...:
                  {{ b.balance.toString() }} (decimals: {{ b.decimals }})
                </p>
              </div>
            </div>
            <div v-if="lastUserOpHash" class="text-xs text-green-600 break-all">
              Last userOpHash: {{ lastUserOpHash }}
            </div>
          </div>

          <!-- Recovery Tab -->
          <div
            v-if="activeTab === 'recovery'"
            class="flex flex-col gap-4 w-full"
          >
            <div>
              <label class="block text-sm font-semibold mb-1 text-gray-900"
                >Add Recovery EOA</label
              >
              <div class="flex gap-2">
                <input
                  v-model="recoveryEoa"
                  type="text"
                  placeholder="0x..."
                  class="flex-1 px-4 py-2 rounded bg-gray-800 border border-gray-700 text-white text-sm focus:border-amber-500 focus:outline-none"
                />
                <CustomButton
                  text="Add Owner"
                  :loading="busy"
                  @button-clicked="handleAddOwner"
                />
              </div>
            </div>
            <div v-if="lastUserOpHash" class="text-xs text-green-600 break-all">
              Last userOpHash: {{ lastUserOpHash }}
            </div>
            <div>
              <p class="text-sm font-semibold mb-2 text-gray-900">
                Current Owners
              </p>
              <div
                v-if="owners.length === 0 && ownersPublicKeys.length === 0"
                class="text-sm text-gray-400"
              >
                No EOA owners listed. Passkey owners are managed by the plugin.
              </div>
              <div
                v-if="owners.length > 0"
                class="text-sm text-gray-600 space-y-1"
              >
                <p class="text-xs text-gray-400 mb-1">EOA Owners:</p>
                <p v-for="(owner, i) in owners" :key="i" class="break-all">
                  {{ owner }}
                </p>
              </div>
              <div
                v-if="ownersPublicKeys.length > 0"
                class="text-sm text-gray-600 space-y-1 mt-2"
              >
                <p class="text-xs text-gray-400 mb-1">Passkey Owners:</p>
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
  @apply px-4 py-2 rounded text-gray-400 font-semibold text-sm transition-colors border border-gray-700;
}

.tab-button.active {
  @apply text-white border-amber-500 bg-amber-500/10;
}
</style>

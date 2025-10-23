<script setup lang="ts">
import { ref } from 'vue';

interface Transaction {
  id: string;
  type: 'deposit' | 'lock' | 'release' | 'return';
  timestamp: string;
  seller?: string;
  buyer?: string | null;
  amount: string;
  token: string;
  blockNumber: string;
  transactionHash: string;
}

interface Props {
  transactions: Transaction[];
  networkExplorerUrl: string;
}

const props = defineProps<Props>();

const copyFeedback = ref<{ [key: string]: boolean }>({});
const copyFeedbackTimeout = ref<{ [key: string]: NodeJS.Timeout | null }>({});

const getTransactionTypeInfo = (type: string) => {
  const typeMap = {
    deposit: { label: 'Depósito', status: 'completed' as const },
    lock: { label: 'Bloqueio', status: 'open' as const },
    release: { label: 'Liberação', status: 'completed' as const },
    return: { label: 'Retorno', status: 'expired' as const }
  };
  return typeMap[type as keyof typeof typeMap] || { label: type, status: 'pending' as const };
};

const getTransactionTypeColor = (type: string) => {
  const colorMap = {
    deposit: 'text-emerald-600',
    lock: 'text-amber-600', 
    release: 'text-emerald-600',
    return: 'text-gray-600'
  };
  return colorMap[type as keyof typeof colorMap] || 'text-gray-600';
};

const formatAddress = (address: string) => {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

const formatAmount = (amount: string, decimals: number = 18): string => {
  const num = parseFloat(amount) / Math.pow(10, decimals);
  return num.toString();
};

const getExplorerUrl = (txHash: string) => {
  return `${props.networkExplorerUrl}/tx/${txHash}`;
};

const copyToClipboard = async (address: string, key: string) => {
  if (!address) {
    return;
  }

  try {
    await navigator.clipboard.writeText(address);

    if (copyFeedbackTimeout.value[key]) {
      clearTimeout(copyFeedbackTimeout.value[key]!);
    }

    copyFeedback.value[key] = true;

    copyFeedbackTimeout.value[key] = setTimeout(() => {
      copyFeedback.value[key] = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
};
</script>

<template>
  <div>
    <div class="hidden lg:block overflow-x-auto">
      <table class="w-full">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left py-3 px-4 text-gray-700 font-medium">Horário</th>
            <th class="text-left py-3 px-4 text-gray-700 font-medium">Tipo</th>
            <th class="text-left py-3 px-4 text-gray-700 font-medium">Participantes</th>
            <th class="text-left py-3 px-4 text-gray-700 font-medium">Valor</th>
            <th class="text-left py-3 px-4 text-gray-700 font-medium">Bloco</th>
            <th class="text-left py-3 px-4 text-gray-700 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="transaction in transactions" 
            :key="transaction.id"
            class="border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <td class="py-4 px-4">
              <div class="text-sm text-gray-600">{{ transaction.timestamp }}</div>
            </td>
            <td class="py-4 px-4">
              <span 
                :class="getTransactionTypeColor(transaction.type)"
                class="text-sm font-medium"
              >
                {{ getTransactionTypeInfo(transaction.type).label }}
              </span>
            </td>
            <td class="py-4 px-4">
              <div class="space-y-1">
                <div v-if="transaction.seller" class="text-sm">
                  <span class="text-gray-600">Vendedor: </span>
                  <div class="relative inline-block">
                    <span 
                      class="text-gray-900 font-mono cursor-pointer hover:text-amber-500 transition-colors"
                      @click="copyToClipboard(transaction.seller, `seller-${transaction.id}`)"
                      title="Copiar"
                    >
                      {{ formatAddress(transaction.seller) }}
                    </span>
                    <transition name="fade">
                      <span
                        v-if="copyFeedback[`seller-${transaction.id}`]"
                        class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-emerald-500 font-semibold bg-white px-2 py-1 rounded shadow-sm whitespace-nowrap z-10"
                      >
                        Copiado!
                      </span>
                    </transition>
                  </div>
                </div>
                <div v-if="transaction.buyer" class="text-sm">
                  <span class="text-gray-600">Comprador: </span>
                  <div class="relative inline-block">
                    <span 
                      class="text-gray-900 font-mono cursor-pointer hover:text-amber-500 transition-colors"
                      @click="copyToClipboard(transaction.buyer, `buyer-${transaction.id}`)"
                      title="Copiar"
                    >
                      {{ formatAddress(transaction.buyer) }}
                    </span>
                    <transition name="fade">
                      <span
                        v-if="copyFeedback[`buyer-${transaction.id}`]"
                        class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-emerald-500 font-semibold bg-white px-2 py-1 rounded shadow-sm whitespace-nowrap z-10"
                      >
                        Copiado!
                      </span>
                    </transition>
                  </div>
                </div>
              </div>
            </td>
            <td class="py-4 px-4">
              <div class="text-sm font-semibold text-emerald-600">
                {{ formatAmount(transaction.amount, 18) }} BRZ
              </div>
            </td>
            <td class="py-4 px-4">
              <div class="text-sm text-gray-600 font-mono">
                #{{ transaction.blockNumber }}
              </div>
            </td>
            <td class="py-4 px-4">
              <a
                :href="getExplorerUrl(transaction.transactionHash)"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-3 py-1 bg-amber-400 text-gray-900 rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors"
              >
                Explorador
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Mobile Cards -->
    <div class="lg:hidden space-y-4">
      <div 
        v-for="transaction in transactions" 
        :key="transaction.id"
        class="bg-gray-50 rounded-lg p-4 border border-gray-200"
      >
        <div class="flex items-center justify-between mb-3">
          <span 
            :class="getTransactionTypeColor(transaction.type)"
            class="text-sm font-medium"
          >
            {{ getTransactionTypeInfo(transaction.type).label }}
          </span>
          <div class="text-sm text-gray-600">{{ transaction.timestamp }}</div>
        </div>
        
        <div class="space-y-2 mb-4">
          <div v-if="transaction.seller" class="text-sm">
            <span class="text-gray-600">Vendedor: </span>
            <div class="relative inline-block">
              <span 
                class="text-gray-900 font-mono cursor-pointer hover:text-amber-500 transition-colors"
                @click="copyToClipboard(transaction.seller, `seller-${transaction.id}`)"
                title="Copiar"
              >
                {{ formatAddress(transaction.seller) }}
              </span>
              <transition name="fade">
                <span
                  v-if="copyFeedback[`seller-${transaction.id}`]"
                  class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-emerald-500 font-semibold bg-white px-2 py-1 rounded shadow-sm whitespace-nowrap z-10"
                >
                  Copiado!
                </span>
              </transition>
            </div>
          </div>
          <div v-if="transaction.buyer" class="text-sm">
            <span class="text-gray-600">Comprador: </span>
            <div class="relative inline-block">
              <span 
                class="text-gray-900 font-mono cursor-pointer hover:text-amber-500 transition-colors"
                @click="copyToClipboard(transaction.buyer, `buyer-${transaction.id}`)"
                title="Copiar"
              >
                {{ formatAddress(transaction.buyer) }}
              </span>
              <transition name="fade">
                <span
                  v-if="copyFeedback[`buyer-${transaction.id}`]"
                  class="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs text-emerald-500 font-semibold bg-white px-2 py-1 rounded shadow-sm whitespace-nowrap z-10"
                >
                  Copiado!
                </span>
              </transition>
            </div>
          </div>
          <div class="text-sm">
            <span class="text-gray-600">Valor: </span>
              <span class="font-semibold text-emerald-600">{{ formatAmount(transaction.amount, 18) }} BRZ</span>
            </div>
          <div class="text-sm">
            <span class="text-gray-600">Bloco: </span>
            <span class="text-gray-900 font-mono">#{{ transaction.blockNumber }}</span>
          </div>
        </div>
        
        <a
          :href="getExplorerUrl(transaction.transactionHash)"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center px-3 py-1 bg-amber-400 text-gray-900 rounded-lg text-sm font-medium hover:bg-amber-500 transition-colors"
        >
          Ver no Explorador
        </a>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="transactions.length === 0" class="text-center py-12">
      <div class="text-gray-500 text-lg mb-2">📭</div>
      <p class="text-gray-600">Nenhuma transação encontrada</p>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

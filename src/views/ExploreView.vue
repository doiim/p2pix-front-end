<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import { useGraphQL } from '@/composables/useGraphQL';
import FormCard from '@/components/ui/FormCard.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import AnalyticsCard from '@/components/Explorer/AnalyticsCard.vue';
import TransactionTable from '@/components/Explorer/TransactionTable.vue';
import { getBlockExplorerUrl } from '@/config/networks';

const user = useUser();
const { networkName } = user;

const {
  searchAddress,
  selectedType,
  transactions,
  analytics,
  loading,
  error,
  analyticsLoading,
  fetchAllActivity,
  fetchUserActivity,
  fetchAnalytics,
  clearData
} = useGraphQL(networkName.value);

const transactionTypes = [
  { key: 'all', label: 'Todas' },
  { key: 'deposit', label: 'Depósitos' },
  { key: 'lock', label: 'Bloqueios' },
  { key: 'release', label: 'Liberações' },
  { key: 'return', label: 'Retornos' }
];

const handleTypeFilter = (type: string) => {
  selectedType.value = type;
};

watch(searchAddress, async (newAddress) => {
  if (newAddress.trim()) {
    await fetchUserActivity(newAddress.trim());
  } else {
    await fetchAllActivity();
  }
});

watch(networkName, async () => {
  clearData();
  await Promise.all([
    fetchAllActivity(),
    fetchAnalytics()
  ]);
}, { deep: true });

onMounted(async () => {
  await Promise.all([
    fetchAllActivity(),
    fetchAnalytics()
  ]);
});
</script>

<template>
  <div class="min-h-screen">
    <div class="container mx-auto px-4 py-8">

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <AnalyticsCard
          title="Volume Total"
          :value="analytics.totalVolume"
          :loading="analyticsLoading"
        />
        
        <AnalyticsCard
          title="Total de Transações"
          :value="analytics.totalTransactions"
          :loading="analyticsLoading"
        />
        
        <AnalyticsCard
          title="Total de Bloqueios"
          :value="analytics.totalLocks"
          :loading="analyticsLoading"
        />
        
        <AnalyticsCard
          title="Total de Depósitos"
          :value="analytics.totalDeposits"
          :loading="analyticsLoading"
        />
        
        <AnalyticsCard
          title="Total de Liberações"
          :value="analytics.totalReleases"
          :loading="analyticsLoading"
        />
      </div>

      <!-- Search and Filters -->
      <FormCard padding="lg" class="mb-6">
        <div class="space-y-4">
          <!-- Search Input -->
          <div class="flex-1">
            <input
              v-model="searchAddress"
              type="text"
              placeholder="Buscar por endereço de carteira..."
              class="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          </div>

          <!-- Type Filters -->
          <div class="flex flex-wrap gap-2">
            <button
              v-for="type in transactionTypes"
              :key="type.key"
              @click="handleTypeFilter(type.key)"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                selectedType === type.key
                  ? 'bg-amber-400 text-gray-900'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              ]"
            >
              {{ type.label }}
            </button>
          </div>
        </div>
      </FormCard>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <LoadingComponent title="Carregando transações..." />
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="text-center py-12">
        <div class="text-red-600 text-lg mb-2">⚠️</div>
        <p class="text-red-600 mb-2">Erro ao carregar transações</p>
        <p class="text-gray-600 text-sm">{{ error }}</p>
      </div>

      <!-- Transactions Table -->
      <FormCard v-else padding="lg">
        <div class="mb-6">
          <h2 class="text-xl font-semibold text-gray-900 mb-2">Transações Recentes</h2>
          <p class="text-gray-600">{{ transactions.length }} transações encontradas</p>
        </div>

        <TransactionTable 
          :transactions="transactions"
          :network-explorer-url="getBlockExplorerUrl(networkName)"
        />
      </FormCard>
    </div>
  </div>
</template>

<style scoped>
.container {
  max-width: 1200px;
}
</style>
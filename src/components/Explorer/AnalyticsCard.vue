<script setup lang="ts">
interface Props {
  title: string;
  value: string;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  changeType: 'neutral',
  loading: false
});
</script>

<template>
  <div class="analytics-card">
    <div class="analytics-content">
      <div v-if="loading" class="analytics-value">
        <div class="animate-pulse bg-gray-300 h-8 w-16 rounded"></div>
      </div>
      <div v-else class="analytics-value">{{ value }}</div>
      <div class="analytics-title">{{ title }}</div>
      <div v-if="change && !loading" class="analytics-change" :class="`change-${changeType}`">
        {{ change }}
      </div>
    </div>
    <div v-if="icon && !loading" class="analytics-icon">
      <img :src="icon" :alt="`${title} icon`" class="w-8 h-8" />
    </div>
  </div>
</template>

<style scoped>
.analytics-card {
  @apply bg-white rounded-lg border border-gray-200 p-6 flex items-center justify-between shadow-lg;
}

.analytics-content {
  @apply flex flex-col;
}

.analytics-value {
  @apply text-2xl font-bold text-amber-400 mb-1 break-words overflow-hidden;
  word-break: break-all;
  max-width: 100%;
}

.analytics-title {
  @apply text-sm text-gray-900 mb-1;
}

.analytics-change {
  @apply text-xs font-medium;
}

.change-positive {
  @apply text-green-600;
}

.change-negative {
  @apply text-red-600;
}

.change-neutral {
  @apply text-gray-600;
}

.analytics-icon {
  @apply flex-shrink-0;
}
</style>

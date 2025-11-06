<script setup lang="ts">
import { computed } from "vue";

export type StatusType = "open" | "expired" | "completed" | "pending";

const props = defineProps<{
  status: StatusType;
  customText?: string;
}>();

const statusConfig = computed(() => {
  const configs: Record<StatusType, { text: string; color: string }> = {
    open: {
      text: "Em Aberto",
      color: "bg-amber-300",
    },
    expired: {
      text: "Expirado",
      color: "bg-[#94A3B8]",
    },
    completed: {
      text: "Finalizado",
      color: "bg-emerald-300",
    },
    pending: {
      text: "Pendente",
      color: "bg-gray-300",
    },
  };

  return configs[props.status];
});

const displayText = computed(() => {
  return props.customText || statusConfig.value.text;
});
</script>

<template>
  <div :class="[statusConfig.color, 'status-badge']">
    {{ displayText }}
  </div>
</template>

<style scoped>
.status-badge {
  @apply text-xs sm:text-base font-medium text-gray-900 rounded-lg text-center px-2 py-1;
}
</style>


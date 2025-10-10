<script setup lang="ts">
import { computed } from "vue";
import { NetworkEnum } from "@/model/NetworkEnum";
import { getNetworkImage } from "@/utils/imagesPath";

const props = withDefaults(
  defineProps<{
    networks: NetworkEnum[];
    size?: "sm" | "md" | "lg";
    showLabel?: boolean;
  }>(),
  {
    size: "md",
    showLabel: false,
  }
);

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 32,
};

const networkData = computed(() => {
  return props.networks.map((network) => ({
    network,
    image: getNetworkImage(String(network)),
    name: String(network),
  }));
});
</script>

<template>
  <div class="network-badges">
    <div
      v-for="data in networkData"
      :key="data.network"
      class="network-badge"
      :title="data.name"
    >
      <img
        :alt="`${data.name} logo`"
        :src="data.image"
        :width="sizeMap[size]"
        :height="sizeMap[size]"
        class="network-icon"
      />
      <span v-if="showLabel" class="network-label">
        {{ data.name }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.network-badges {
  @apply flex gap-2 items-center;
}

.network-badge {
  @apply flex items-center gap-1;
}

.network-icon {
  @apply flex-shrink-0;
}

.network-label {
  @apply text-sm font-medium text-gray-900;
}
</style>


<script setup lang="ts">
import { computed } from "vue";
import { Networks } from "@/config/networks";
import type { NetworkConfig } from "@/model/NetworkEnum";
import { getNetworkImage } from "@/utils/imagesPath";
import Dropdown, { type DropdownItem } from "./Dropdown.vue";

const props = withDefaults(
  defineProps<{
    modelValue: NetworkConfig;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    availableNetworks?: NetworkConfig[];
  }>(),
  {
    disabled: false,
    size: "md",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: NetworkConfig];
  change: [value: NetworkConfig];
}>();

const networkItems = computed((): DropdownItem<NetworkConfig>[] => {  
  return Object.values(Networks).map((network) => ({
    value: network,
    label: network.name,
    icon: getNetworkImage(network.name),
  }));
});

const handleChange = (value: NetworkConfig) => {
  emit("update:modelValue", value);
  emit("change", value);
};
</script>

<template>
  <Dropdown
    :model-value="modelValue"
    :items="networkItems"
    :disabled="disabled"
    :size="size"
    :show-icon="true"
    @update:model-value="handleChange"
  />
</template>


<script setup lang="ts">
import { computed } from "vue";
import { NetworkEnum } from "@/model/NetworkEnum";
import { Networks } from "@/model/Networks";
import { getNetworkImage } from "@/utils/imagesPath";
import Dropdown, { type DropdownItem } from "./Dropdown.vue";

const props = withDefaults(
  defineProps<{
    modelValue: NetworkEnum;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
    availableNetworks?: NetworkEnum[];
  }>(),
  {
    disabled: false,
    size: "md",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: NetworkEnum];
  change: [value: NetworkEnum];
}>();

const networkItems = computed((): DropdownItem<NetworkEnum>[] => {
  const networks = props.availableNetworks || (Object.values(NetworkEnum).filter(v => typeof v === 'number') as NetworkEnum[]);
  
  return networks.map((network) => ({
    value: network,
    label: Networks[network]?.chainName || String(network),
    icon: getNetworkImage(String(network)),
  }));
});

const handleChange = (value: NetworkEnum) => {
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


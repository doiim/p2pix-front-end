<script setup lang="ts">
import { computed } from "vue";
import { TokenEnum } from "@/model/NetworkEnum";
import { getTokenImage } from "@/utils/imagesPath";
import Dropdown, { type DropdownItem } from "./Dropdown.vue";

const props = withDefaults(
  defineProps<{
    modelValue: TokenEnum;
    disabled?: boolean;
    size?: "sm" | "md" | "lg";
  }>(),
  {
    disabled: false,
    size: "md",
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: TokenEnum];
  change: [value: TokenEnum];
}>();

const tokenItems = computed((): DropdownItem<TokenEnum>[] => {
  return Object.values(TokenEnum).map((token) => ({
    value: token,
    label: token,
    icon: getTokenImage(token),
  }));
});

const handleChange = (value: TokenEnum) => {
  emit("update:modelValue", value);
  emit("change", value);
};
</script>

<template>
  <Dropdown
    :model-value="modelValue"
    :items="tokenItems"
    :disabled="disabled"
    :size="size"
    :show-icon="true"
    @update:model-value="handleChange"
  />
</template>


<script setup lang="ts">
export type HeaderSize = "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    title: string;
    subtitle?: string;
    size?: HeaderSize;
    centered?: boolean;
  }>(),
  {
    size: "lg",
    centered: true,
  }
);
</script>

<template>
  <div
    :class="['page-header', `size-${size}`, { centered: centered }]"
  >
    <h1 class="title text-white font-extrabold">
      {{ title }}
    </h1>
    <p v-if="subtitle" class="subtitle text-white font-medium">
      {{ subtitle }}
    </p>
    <slot></slot>
  </div>
</template>

<style scoped>
.page-header {
  @apply flex flex-col gap-4;
}

.page-header.centered {
  @apply items-center justify-center text-center;
}

/* Tamanhos */
.size-sm .title {
  @apply sm:text-2xl text-xl sm:max-w-[20rem] max-w-[16rem];
}

.size-sm .subtitle {
  @apply sm:text-sm text-xs sm:max-w-[18rem] max-w-[14rem];
}

.size-md .title {
  @apply sm:text-4xl text-2xl sm:max-w-[28rem] max-w-[22rem];
}

.size-md .subtitle {
  @apply sm:text-base text-sm sm:max-w-[26rem] max-w-[20rem];
}

.size-lg .title {
  @apply sm:text-5xl text-3xl sm:max-w-[29rem] max-w-[20rem];
}

.size-lg .subtitle {
  @apply sm:text-base text-sm sm:max-w-[28rem] max-w-[30rem] sm:tracking-normal tracking-wide;
}
</style>


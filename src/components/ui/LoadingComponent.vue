<script setup lang="ts">
// prop
const props = defineProps({
  title: String,
  message: String,
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span
        class="text font-bold sm:text-3xl text-2xl sm:max-w-[29rem] max-w-[20rem]"
      >
        {{ props.title ? props.title : "Confirme em sua carteira" }}
      </span>
    </div>
    <div class="main-container max-w-md">
      <div
        class="flex flex-col w-full bg-white sm:px-10 px-4 py-5 rounded-lg border-y-10"
      >
        <div
          class="flex flex-col text-center justify-center w-full items-center p-2 px-3 rounded-3xl lg:min-w-fit gap-1"
        >
          <img
            alt="Polygon image"
            src="@/assets/validating.svg?url"
            width="96"
            height="48"
          />
          <span class="text-black font-medium text-sm lg:px-12 px-4 mt-4">
            {{ $props.message }}
          </span>
          <div class="spinner mt-4"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-divide {
  width: 100%;
  border-bottom: 1px solid #d1d5db;
}
.bottom-position {
  top: -20px;
  right: 50%;
  transform: translateX(50%);
}

.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.text {
  @apply text-white text-center;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #f59e0b;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

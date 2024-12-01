<script setup lang="ts">
import { pix } from "@/utils/QrCodePix";
import { onMounted, onUnmounted, ref } from "vue";
import CustomButton from "@/components/CustomButton/CustomButton.vue";
import CustomModal from "@/components//CustomModal/CustomModal.vue";

// props and store references
const props = defineProps({
  sellerId: String,
  amount: Number,
});

const windowSize = ref<number>(window.innerWidth);
const qrCode = ref<string>("");
const isPixValid = ref<boolean>(false);
const showWarnModal = ref<boolean>(true);
const releaseSignature = ref<string>("");

// Emits
const emit = defineEmits(["pixValidated"]);

onMounted(() => {
  window.addEventListener(
    "resize",
    () => (windowSize.value = window.innerWidth)
  );
});
onUnmounted(() => {
  window.removeEventListener(
    "resize",
    () => (windowSize.value = window.innerWidth)
  );
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span
        class="text font-extrabold lg:text-2xl text-xl sm:max-w-[30rem] max-w-[24rem]"
      >
        Utilize o QR Code ou copie o código para realizar o Pix
      </span>
      <span class="text font-medium lg:text-md text-sm max-w-[28rem]">
        Após realizar o Pix no banco de sua preferência, clique no botão abaixo
        para liberação dos tokens.
      </span>
    </div>
    <div class="main-container max-w-md text-black">
      <div
        class="flex-col items-center justify-center flex w-full bg-white sm:p-8 p-4 rounded-lg break-normal"
      >
        <img alt="Qr code image" :src="qrCode" class="w-48 h-48" />
        <span class="text-center font-bold">Código pix</span>
        <div class="break-words w-4/5">
          <span class="text-center text-xs">
            {{ qrCode }}
          </span>
        </div>
        <img
          alt="Copy PIX code"
          src="@/assets/copyPix.svg?url"
          width="16"
          height="16"
          class="pt-2 lg:mb-5 cursor-pointer"
        />
      </div>
      <CustomButton
        :is-disabled="isPixValid == false"
        :text="'Enviar para a rede'"
        @button-clicked="emit('pixValidated', releaseSignature)"
      />
    </div>
    <CustomModal
      v-if="showWarnModal && windowSize <= 500"
      @close-modal="showWarnModal = false"
      :isRedirectModal="false"
    />
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

::placeholder {
  /* Most modern browsers support this now. */
  color: #9ca3af;
}

h4 {
  color: #080808;
  font-size: 14px;
}

h2 {
  color: #080808;
}

.form-input {
  @apply rounded-lg border border-gray-200 p-2 text-black;
}

.form-label {
  @apply font-semibold tracking-wide text-emerald-50;
}

.custom-divide {
  width: 100%;
  border-bottom: 1px solid #d1d5db;
}
.bottom-position {
  top: -20px;
  right: 50%;
  transform: translateX(50%);
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.text {
  @apply text-white text-center;
}

.blur-container {
  @apply flex flex-col justify-center items-center px-8 py-6 gap-2 rounded-lg shadow-md shadow-gray-600 backdrop-blur-md mt-6 max-w-screen-sm;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

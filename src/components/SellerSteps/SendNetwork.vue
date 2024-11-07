<script setup lang="ts">
import CustomButton from "@/components/CustomButton/CustomButton.vue";

// Emits
const emit = defineEmits(["sendNetwork"]);

// props and store references
const props = defineProps({
  pixKey: String,
  offer: Number,
  selectedToken: String,
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span
        class="text font-extrabold sm:text-5xl text-xl sm:max-w-[50rem] max-w-[20rem]"
        >Envie sua oferta para a rede
      </span>
      <span
        class="text font-normal sm:text-base text-xs sm:max-w-[30rem] max-w-[22rem]"
        >Após a confirmação sua oferta estará disponível para outros usuários.
        Caso deseje retirar a oferta, será necessário aguardar 24h para receber
        os tokens de volta.</span
      >
    </div>
    <div class="blur-container">
      <div
        class="flex flex-col w-full bg-white px-10 py-5 rounded-lg border-y-10"
      >
        <div>
          <p>Tokens ofertados</p>
          <p class="text-2xl text-gray-900">
            {{ props.offer }} {{ props.selectedToken }}
          </p>
        </div>
        <div class="my-3">
          <p>Chave Pix</p>
          <p class="text-xl text-gray-900 break-words">
            {{ props.pixKey }}
          </p>
        </div>
        <div class="mb-5">
          <p>
            <b>Atenção! </b> Os tokens ofertados ficam registrados no smart
            contract e serão transferidos automaticamente para o comprador assim
            que o Pix for detectado e confirmado.
          </p>
        </div>
        <CustomButton
          :text="'Enviar para a rede'"
          @buttonClicked="emit('sendNetwork')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

p {
  @apply text-gray-900;
}

.text-container {
  @apply flex flex-col items-center justify-center sm:gap-4 gap-2;
}

.text {
  @apply text-white text-center;
}

.blur-container {
  @apply flex flex-col justify-center items-center px-8 py-6 gap-2 rounded-lg shadow-md shadow-gray-600 backdrop-blur-md mt-8 max-w-screen-sm;
}

.last-deposit-info {
  @apply font-medium text-base;
}

input[type="number"] {
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

<script setup lang="ts">
import { ref } from "vue";

const props = defineProps({
  isRedirectModal: Boolean,
});

const modalColor = ref<string>("white");
const modalHeight = ref<string>("250px");
const pFontSize = ref<string>("16px");

if (props.isRedirectModal) {
  modalColor.value = "rgba(251, 191, 36, 1)";
  modalHeight.value = "150px";
  pFontSize.value = "20px";
}
</script>

<template>
  <div>
    <div
      class="modal-overlay inset-0 fixed justify-center backdrop-blur-sm sm:backdrop-blur-none"
      v-if="!isRedirectModal"
    >
      <div class="modal px-5 text-center">
        <p
          class="text-black tracking-tighter leading-tight my-6 mx-2 text-justify"
        >
          <strong>ATENÇÃO!</strong>
          A transação só será processada após efetuado o pagamento do Pix. Caso
          contrário não conseguiremos comprovar o seu depósito e não será
          possível transferir os tokens para sua carteira.
        </p>
        <button
          @click="$emit('close-modal')"
          class="border-2 border-solid border-amber-400 mt-2"
        >
          Entendi
        </button>
      </div>
    </div>
    <div
      class="modal-overlay inset-0 fixed justify-center backdrop-blur-sm"
      v-if="isRedirectModal"
    >
      <div class="modal px-5 text-center">
        <p
          class="text-black text-lg tracking-tighter leading-tight my-6 mx-2 text-justify font-semibold"
        >
          Retomar a última compra?
        </p>
        <div class="flex justify-around items-center px-2">
          <button
            @click="$emit('close-modal')"
            class="border-2 border-solid border-white-400 mt-2 font-semibold"
          >
            Não
          </button>
          <button
            @click="$emit('go-to-lock')"
            class="border-2 border-solid border-white-400 mt-2 font-semibold"
          >
            Sim
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-overlay {
  display: flex !important;
  justify-content: center;
  align-items: center;
  height: 100%;
  width: 100%;
}

.modal {
  background-color: v-bind(modalColor);
  height: v-bind(modalHeight);
  width: 300px;
  border-radius: 10px;
}
.close {
  cursor: pointer;
}

.close-img {
  width: 25px;
}

.check {
  width: 150px;
}

h6 {
  font-weight: 500;
  font-size: 28px;
  margin: 20px 0;
}

p {
  font-size: v-bind(pFontSize);
}

button {
  width: 100px;
  height: 40px;
  color: black;
  font-size: 14px;
  border-radius: 10px;
}
</style>

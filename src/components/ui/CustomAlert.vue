<script setup lang="ts">
import { ref } from "vue";
const props = defineProps<{
  type: string;
}>();

const alertText = ref<string>("");
const alertPaddingLeft = ref<string>("18rem");

if (props.type === "sell") {
  alertPaddingLeft.value = "30%";
} else if (props.type === "buy") {
  alertPaddingLeft.value = "30%";
} else if (props.type === "withdraw") {
  alertPaddingLeft.value = "40%";
} else if (props.type === "redirect") {
  alertPaddingLeft.value = "35%";
}

switch (props.type) {
  case "buy":
    alertText.value =
      "Tudo certo! Os tokens já foram retirados da oferta e estão disponíveis na sua carteira.";
    break;
  case "sell":
    alertText.value =
      "Tudo certo! Os tokens já foram reservados e sua oferta está disponível.";
    break;
  case "redirect":
    alertText.value = "Existe uma compra em aberto. Continuar?";
    break;
  case "withdraw":
    alertText.value = "Tudo certo! Saque realizado com sucesso!";
    break;
}
</script>
<template>
  <div
    class="modal-overlay sm:h-12 h-full inset-0 absolute backdrop-blur-sm sm:backdrop-blur-none"
  >
    <div class="modal px-12 text-center sm:flex justify-between hidden">
      <div class="flex items-center">
        <p class="text-black tracking-tighter leading-tight py-2">
          {{ alertText }}
        </p>
        <button v-if="props.type === 'redirect'" @click="$emit('go-to-lock')">
          Sim
        </button>
      </div>
      <img
        src="../../assets/closeAlertIcon.svg"
        alt="close alert"
        class="w-3 cursor-pointer"
        @click="$emit('close-alert')"
      />
    </div>
    <div
      class="modal-mobile px-7 py-3 text-center inline-block sm:hidden mt-24 h-48"
      v-if="props.type !== 'redirect'"
    >
      <p class="text-black tracking-tighter leading-tight my-2 text-start mb-4">
        {{ alertText }}
      </p>
      <button
        @click="$emit('close-alert')"
        class="border-2 border-solid border-amber-400 mt-2"
      >
        Ok
      </button>
    </div>
    <div
      class="modal-mobile px-5 text-center inline-block sm:hidden mt-24 h-40"
      v-if="props.type === 'redirect'"
    >
      <p
        class="text-black text-lg tracking-tighter leading-tight my-6 mx-2 text-justify font-semibold"
      >
        Retomar a última compra?
      </p>
      <div class="flex justify-around items-center px-2">
        <button
          @click="$emit('close-alert')"
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
</template>
<style scoped>
.modal-overlay {
  display: flex !important;
  justify-content: center;
  width: 100%;
  padding-top: 7rem;
  z-index: 10;
}

.modal {
  background-color: rgba(251, 191, 36, 1);
  height: 3rem;
  width: 96%;
  border-radius: 10px;
  align-items: center;
  white-space: nowrap;
}

.modal-mobile {
  background-color: rgba(251, 191, 36, 1);
  /* height: 200px; */
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
  font-size: 20px;
  font-weight: 600;
}

button {
  width: 50px;
  height: 30px;
  color: black;
  font-size: 16px;
  border-radius: 10px;
  border: 2px solid white;
  margin-left: 1rem;
}
</style>

<script setup lang="ts">
import { ref } from "vue";
import { useUser } from "@/composables/useUser";
import CustomButton from "@/components/ui/CustomButton.vue";
import { debounce } from "@/utils/debounce";
import { decimalCount } from "@/utils/decimalCount";
import { getTokenImage } from "@/utils/imagesPath";
import { useOnboard } from "@web3-onboard/vue";

// Store
const user = useUser();
const { walletAddress } = user;

// Reactive state
const tokenValue = ref<number>(0);
const enableSelectButton = ref<boolean>(false);
const hasLiquidity = ref<boolean>(true);
const validDecimals = ref<boolean>(true);

// Emits
const emit = defineEmits(["tokenBuy"]);

// Blockchain methods
const connectAccount = async (): Promise<void> => {
  const { connectWallet } = useOnboard();
  await connectWallet();
};

// Debounce methods
const handleInputEvent = (event: any): void => {
  const { value } = event.target;

  tokenValue.value = Number(value);

  if (decimalCount(String(tokenValue.value)) > 2) {
    validDecimals.value = false;
    enableSelectButton.value = false;
    return;
  }
  validDecimals.value = true;
};
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold text-5xl max-w-[29rem]"
        >Adquira cripto com apenas um Pix</span
      >
      <span class="text font-medium text-base max-w-[28rem]"
        >Digite um valor, confira a oferta, conecte sua carteira e receba os
        tokens após realizar o Pix</span
      >
    </div>
    <div class="main-container">
      <div
        class="flex flex-col w-full bg-white px-10 py-5 rounded-lg border-y-10"
      >
        <div class="flex justify-between w-full items-center">
          <input
            type="number"
            class="border-none outline-none text-lg text-gray-900 w-fit"
            v-bind:class="{
              'font-semibold': tokenValue != undefined,
              'text-xl': tokenValue != undefined,
            }"
            @input="debounce(handleInputEvent, 500)($event)"
            placeholder="0  "
            step=".01"
          />
          <div
            class="flex flex-row p-2 px-3 bg-gray-300 rounded-3xl min-w-fit gap-1"
          >
            <img
              alt="Token image"
              class="w-fit"
              :src="getTokenImage(user.selectedToken.value)"
            />
            <span class="text-gray-900 text-lg w-fit" id="token">{{
              user.selectedToken
            }}</span>
          </div>
        </div>

        <div class="custom-divide py-2"></div>
        <div class="flex justify-between pt-2" v-if="hasLiquidity">
          <p class="text-gray-500 font-normal text-sm w-auto">
            ~ R$ {{ tokenValue.toFixed(2) }}
          </p>
          <div class="flex gap-2">
            <img
              alt="Polygon image"
              src="@/assets/networks/polygon.svg?url"
              width="24"
              height="24"
            />
            <img
              alt="Ethereum image"
              src="@/assets/networks/ethereum.svg?url"
              width="24"
              height="24"
            />
          </div>
        </div>
        <div class="flex pt-2 justify-center" v-if="!validDecimals">
          <span class="text-red-500 font-normal text-sm"
            >Por favor utilize no máximo 2 casas decimais</span
          >
        </div>
        <div class="flex pt-2 justify-center" v-else-if="!hasLiquidity">
          <span class="text-red-500 font-normal text-sm"
            >Atualmente não há liquidez nas redes para sua demanda</span
          >
        </div>
      </div>

      <CustomButton
        v-if="walletAddress"
        :text="'Conectar carteira'"
        @buttonClicked="emit('tokenBuy')"
      />
      <CustomButton
        v-if="!walletAddress"
        :text="'Conectar carteira'"
        @buttonClicked="connectAccount()"
      />
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

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

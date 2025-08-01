<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import CustomButton from "@/components/CustomButton/CustomButton.vue";
import CustomModal from "@/components//CustomModal/CustomModal.vue";
import SpinnerComponent from "@/components/SpinnerComponent.vue";
import { createSolicitation, getSolicitation, type Offer } from "@/utils/bbPay";
import { getParticipantID } from "@/blockchain/events";
import { getUnreleasedLockById } from "@/blockchain/events";
import QRCode from "qrcode";

// Props
interface Props {
  lockID: string;
}

const props = defineProps<Props>();

const qrCode = ref<string>("");
const qrCodeSvg = ref<string>("");
const showWarnModal = ref<boolean>(true);
const pixTimestamp = ref<string>("");
const releaseSignature = ref<string>("");
const solicitationData = ref<any>(null);
const pollingInterval = ref<NodeJS.Timeout | null>(null);

// Function to generate QR code SVG
const generateQrCodeSvg = async (text: string) => {
  try {
    const svgString = await QRCode.toString(text, {
      type: "svg",
      width: 192, // 48 * 4 for better quality
      margin: 2,
      color: {
        dark: "#000000",
        light: "#FFFFFF",
      },
    });
    qrCodeSvg.value = svgString;
  } catch (error) {
    console.error("Error generating QR code SVG:", error);
  }
};

// Emits
const emit = defineEmits(["pixValidated"]);

// Function to check solicitation status
const checkSolicitationStatus = async () => {
  if (!solicitationData.value?.numeroSolicitacao) {
    return;
  }

  try {
    const response = await getSolicitation(
      solicitationData.value.numeroSolicitacao
    );

    if (response.signature) {
      pixTimestamp.value = response.pixTimestamp;
      releaseSignature.value = response.signature;
      // Stop polling when payment is confirmed
      if (pollingInterval.value) {
        clearInterval(pollingInterval.value);
        pollingInterval.value = null;
      }
    }
  } catch (error) {
    console.error("Error checking solicitation status:", error);
  }
};

// Function to start polling
const startPolling = () => {
  // Clear any existing interval
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
  }

  // Start new polling interval (10 seconds)
  pollingInterval.value = setInterval(checkSolicitationStatus, 10000);
};

onMounted(async () => {
  try {
    const { tokenAddress, sellerAddress, amount } = await getUnreleasedLockById(
      BigInt(props.lockID)
    );

    const participantId = await getParticipantID(
      sellerAddress,
      tokenAddress
    );

    const offer: Offer = {
      amount,
      sellerId: participantId,
    };

    const response = await createSolicitation(offer);
    solicitationData.value = response;

    // Update qrCode if the response contains QR code data
    if (response?.informacoesPIX?.textoQrCode) {
      qrCode.value = response.informacoesPIX?.textoQrCode;
      // Generate SVG QR code
      await generateQrCodeSvg(qrCode.value);
    }

    // Start polling for solicitation status
    startPolling();
  } catch (error) {
    console.error("Error creating solicitation:", error);
  }
});

// Clean up interval on component unmount
onUnmounted(() => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value);
    pollingInterval.value = null;
  }
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
        <div
          v-if="qrCodeSvg"
          v-html="qrCodeSvg"
          class="w-48 h-48 flex items-center justify-center"
        ></div>
        <div
          v-else
          class="w-48 h-48 flex items-center justify-center rounded-lg"
        >
          <SpinnerComponent width="8" height="8"></SpinnerComponent>
        </div>
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
        :is-disabled="releaseSignature === ''"
        :text="
          releaseSignature ? 'Enviar para a rede' : 'Validando pagamento...'
        "
        @button-clicked="
          emit('pixValidated', { pixTimestamp, signature: releaseSignature })
        "
      />
    </div>
    <CustomModal
      v-if="showWarnModal"
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
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type="number"]::-webkit-inner-spin-button,
input[type="number"]::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

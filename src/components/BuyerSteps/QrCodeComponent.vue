<script lang="ts">
// Module scope: the charge survives a remount, so a release that reverts
// (HomeView goes back to Step.Buy) reuses the solicitation already created for
// this lock instead of charging the buyer's Pix twice. Map<lockID, charge>;
// one entry per lock bought in this page load.
const solicitations = new Map<string, import('@/utils/bbPay').Solicitation>();
</script>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import CustomButton from '@/components/ui/CustomButton.vue';
import CustomModal from '@/components/ui/CustomModal.vue';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import {
  createSolicitation,
  getSolicitation,
  type Offer,
  type Solicitation,
} from '@/utils/bbPay';
import type { PixProof } from '@/utils/pixProof';
import { getParticipantID } from '@/blockchain/events';
import { getUnreleasedLockById } from '@/blockchain/events';
import { useUser } from '@/composables/useUser';
import QRCode from 'qrcode';

// Props
interface Props {
  lockID: string;
}

const props = defineProps<Props>();

const qrCode = ref<string>('');
const qrCodeSvg = ref<string>('');
const showWarnModal = ref<boolean>(true);
const proof = ref<PixProof | null>(null);
const solicitationData = ref<Solicitation | null>(null);
const submitting = ref<boolean>(false);
let pollingStopped = false;
const copyFeedback = ref<boolean>(false);
const copyFeedbackTimeout = ref<NodeJS.Timeout | null>(null);

// Function to generate QR code SVG
const generateQrCodeSvg = async (text: string) => {
  try {
    const svgString = await QRCode.toString(text, {
      type: 'svg',
      width: 192, // 48 * 4 for better quality
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });
    qrCodeSvg.value = svgString;
  } catch (error) {
    console.error('Error generating QR code SVG:', error);
  }
};

// Emits
const emit = defineEmits<{ pixValidated: [proof: PixProof] }>();

const POLL_INTERVAL_MS = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Polls the prover until it answers with the proof of Pix payment. One
// request at a time: a slow answer never overlaps the next poll.
const pollForProof = async (numeroSolicitacao: string) => {
  while (!pollingStopped && !proof.value) {
    try {
      proof.value = await getSolicitation(numeroSolicitacao);
    } catch (error) {
      console.error('Error checking solicitation status:', error);
    }
    if (!proof.value) await sleep(POLL_INTERVAL_MS);
  }
};

// The pinned proof can be older than the contract's freshness window
// (`proofMaxAgeMs`), which makes `release` revert ProofExpired. Re-read it at
// submit time and emit only that: a stale proof is never submitted, and while
// the re-read runs the button keeps the validating state.
const submitProof = async () => {
  const numeroSolicitacao = solicitationData.value?.numeroSolicitacao;
  if (!numeroSolicitacao || submitting.value) return;

  submitting.value = true;
  try {
    const latest = await getSolicitation(numeroSolicitacao);
    if (!latest) {
      // Prover has no proof to give yet (202/402/503): drop the stale one and
      // resume polling so the button re-enables only on a fresh proof.
      proof.value = null;
      void pollForProof(numeroSolicitacao);
      return;
    }
    emit('pixValidated', latest);
  } catch (error) {
    console.error('Error refreshing proof:', error);
  } finally {
    submitting.value = false;
  }
};

const copyToClipboard = async () => {
  if (!qrCode.value) {
    return;
  }

  try {
    await navigator.clipboard.writeText(qrCode.value);

    if (copyFeedbackTimeout.value) {
      clearTimeout(copyFeedbackTimeout.value);
    }

    copyFeedback.value = true;

    copyFeedbackTimeout.value = setTimeout(() => {
      copyFeedback.value = false;
    }, 2000);
  } catch (error) {
    console.error('Error copying to clipboard:', error);
  }
};

onMounted(async () => {
  // A remount for a lock that already has a charge re-renders that one: the
  // fiat leg may already be paid, so creating another charge would double-charge.
  const cached = solicitations.get(props.lockID);

  if (cached) {
    solicitationData.value = cached;

    if (cached.textoQrCode) {
      qrCode.value = cached.textoQrCode;
      await generateQrCodeSvg(qrCode.value);
    }

    void pollForProof(cached.numeroSolicitacao);
    return;
  }

  try {
    const { tokenAddress, sellerAddress, amount } = await getUnreleasedLockById(
      BigInt(props.lockID),
    );

    const participantId = await getParticipantID(sellerAddress, tokenAddress);

    const offer: Offer = {
      amount,
      sellerId: participantId,
      lockID: BigInt(props.lockID),
      chainId: useUser().network.value.id,
    };

    const response = await createSolicitation(offer);
    solicitations.set(props.lockID, response);
    solicitationData.value = response;

    if (response.textoQrCode) {
      qrCode.value = response.textoQrCode;
      await generateQrCodeSvg(qrCode.value);
    }

    void pollForProof(response.numeroSolicitacao);
  } catch (error) {
    console.error('Error creating solicitation:', error);
  }
});

// Stop polling on component unmount
onUnmounted(() => {
  pollingStopped = true;
  if (copyFeedbackTimeout.value) {
    clearTimeout(copyFeedbackTimeout.value);
    copyFeedbackTimeout.value = null;
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
        <span class="text-center font-bold">Código Pix</span>
        <div class="break-words w-4/5">
          <span class="text-center text-xs">
            {{ qrCode }}
          </span>
        </div>
        <div class="flex flex-col items-center gap-1">
          <img
            alt="Copiar código Pix"
            src="@/assets/copyPix.svg?url"
            width="16"
            height="16"
            class="pt-2 cursor-pointer hover:opacity-70 transition-opacity"
            @click="copyToClipboard"
          />
          <transition name="fade">
            <span
              v-if="copyFeedback"
              class="text-xs text-emerald-500 font-semibold"
            >
              Código copiado!
            </span>
          </transition>
        </div>
      </div>
      <CustomButton
        :is-disabled="!proof || submitting"
        :text="
          proof && !submitting ? 'Enviar para a rede' : 'Validando pagamento...'
        "
        @button-clicked="submitProof"
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
@reference "tailwindcss";
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

input[type='number'] {
  appearance: textfield;
  -moz-appearance: textfield;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
}

/* Fade transition for copy feedback */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>

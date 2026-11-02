<script setup lang="ts">
import { computed, onUnmounted, ref, shallowRef, watch } from 'vue';
import CustomButton from '@/components/ui/CustomButton.vue';
import CustomModal from '@/components/ui/CustomModal.vue';
import SpinnerComponent from '@/components/ui/SpinnerComponent.vue';
import { type Offer } from '@/utils/bbPay';
import type { PixProof } from '@/utils/pixProof';
import { useUser } from '@/composables/useUser';
import { useLockQuery, useParticipantIdQuery } from '@/queries/wallet';
import { useLockSolicitationQuery, usePixProofQuery } from '@/queries/bbPay';
import QRCode from 'qrcode';

// Props
interface Props {
  lockID: string;
}

const props = defineProps<Props>();

const user = useUser();
const { network } = user;

const qrCode = ref<string>('');
const qrCodeSvg = ref<string>('');
const showWarnModal = ref<boolean>(true);
const submitting = ref<boolean>(false);
const copyFeedback = ref<boolean>(false);
const copyFeedbackTimeout = ref<NodeJS.Timeout | null>(null);

// The lock exists on the chain it was created on: every read below stays on
// that chain, even if the wallet switches network while it runs. Do not pass
// the live `network` here: lock ids repeat across chains, so after a switch
// the reads would fetch another chain's lock #N and the solicitation would
// post (and save in localStorage for good) a Pix charge for the wrong lock.
const lockNetwork = shallowRef(network.value);

// The lock feeds the PIX target, which feeds the solicitation; each stage is
// its own cache entry, so re-entering this screen reuses what already resolved.
const lockQuery = useLockQuery(
  lockNetwork,
  computed(() => props.lockID),
);
const sellerAddress = computed(() => lockQuery.data.value?.sellerAddress);
const tokenAddress = computed(() => lockQuery.data.value?.tokenAddress);
const participantQuery = useParticipantIdQuery(
  lockNetwork,
  sellerAddress,
  tokenAddress,
);
// On another network the release would go to that chain's P2Pix, where this
// id is another lock: no charge until the wallet is back on the lock's chain.
const offer = computed<Offer | null>(() => {
  const lock = lockQuery.data.value;
  const participantId = participantQuery.data.value;
  if (network.value.id !== lockNetwork.value.id || !lock || !participantId)
    return null;
  return {
    amount: lock.amount,
    sellerId: participantId,
    lockID: BigInt(props.lockID),
    chainId: lockNetwork.value.id,
  };
});
const solicitationQuery = useLockSolicitationQuery(offer);
const proofQuery = usePixProofQuery(
  computed(() => solicitationQuery.data.value?.numeroSolicitacao ?? null),
);
const proof = computed(() => proofQuery.data.value ?? null);

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

// The polled proof can be older than the contract's freshness window
// (`proofMaxAgeMs`), which makes `release` revert ProofExpired. Re-read it at
// submit time and emit only that; a `null` answer resumes the polling.
const submitProof = async () => {
  if (submitting.value) return;
  submitting.value = true;
  try {
    const { data, error } = await proofQuery.refetch();
    if (error) console.error('Error refreshing proof:', error);
    else if (data) emit('pixValidated', data);
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

// `immediate` matters: a remount for a lock already charged gets the cached
// charge during setup, so a plain watcher would never render its QR code.
watch(
  () => solicitationQuery.data.value?.textoQrCode,
  async (text) => {
    if (!text) return;
    qrCode.value = text;
    await generateQrCodeSvg(text);
  },
  { immediate: true },
);

watch(solicitationQuery.error, (error) => {
  if (error) console.error('Error creating solicitation:', error);
});

// Clean up timeout on component unmount
onUnmounted(() => {
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

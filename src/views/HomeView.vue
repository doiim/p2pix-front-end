<script setup lang="ts">
import SearchComponent from "@/components/SearchComponent.vue";
import LoadingComponent from "@/components/LoadingComponent/LoadingComponent.vue";
import BuyConfirmedComponent from "@/components/BuyConfirmedComponent/BuyConfirmedComponent.vue";
import { ref, onMounted, watch } from "vue";
import { useUser } from "@/composables/useUser";
import QrCodeComponent from "@/components/QrCodeComponent.vue";
import { addLock, releaseLock } from "@/blockchain/buyerMethods";
import { updateWalletStatus, checkUnreleasedLock } from "@/blockchain/wallet";
import { getNetworksLiquidity } from "@/blockchain/events";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { getUnreleasedLockById } from "@/blockchain/events";
import CustomAlert from "@/components/CustomAlert/CustomAlert.vue";
import { getSolicitation } from "@/utils/bbPay";

enum Step {
  Search,
  Buy,
  List,
}

const user = useUser();
user.setSellerView(false);

// States
const { loadingLock, walletAddress, networkName } = user;
const flowStep = ref<Step>(Step.Search);
const participantID = ref<string>();
const sellerAddress = ref<`0x${string}` | undefined>();
const tokenAmount = ref<number>();
const lockID = ref<string>("");
const loadingRelease = ref<boolean>(false);
const showModal = ref<boolean>(false);
const showBuyAlert = ref<boolean>(false);
const paramLockID = window.history.state?.lockID;

const confirmBuyClick = async (
  selectedDeposit: ValidDeposit,
  tokenValue: number
) => {
  participantID.value = selectedDeposit.participantID;
  tokenAmount.value = tokenValue;

  if (selectedDeposit) {
    flowStep.value = Step.Buy;
    user.setLoadingLock(true);

    await addLock(selectedDeposit.seller, selectedDeposit.token, tokenValue)
      .then((_lockID) => {
        lockID.value = _lockID;
      })
      .catch((err) => {
        console.log(err);
        flowStep.value = Step.Search;
      });

    user.setLoadingLock(false);
  }
};

const releaseTransaction = async (lockId: string) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  loadingRelease.value = true;

  const solicitation = await getSolicitation(lockId);

  if (solicitation.status) {
    const release = await releaseLock(solicitation);
    await release.wait();

    await updateWalletStatus();
    loadingRelease.value = false;
  }
};

const checkForUnreleasedLocks = async (): Promise<void> => {
  const lock = await checkUnreleasedLock(walletAddress.value);
  if (lock) {
    lockID.value = lock.lockID;
    tokenAmount.value = lock.amount;
    sellerAddress.value = lock.sellerAddress;
    showModal.value = true;
  } else {
    flowStep.value = Step.Search;
    showModal.value = false;
  }
};

if (paramLockID) {
  const lockToRedirect = await getUnreleasedLockById(paramLockID as string);
  if (lockToRedirect) {
    lockID.value = lockToRedirect.lockID;
    tokenAmount.value = lockToRedirect.amount;
    sellerAddress.value = lockToRedirect.sellerAddress;
    flowStep.value = Step.Buy;
  } else {
    flowStep.value = Step.Search;
  }
} else {
  watch(walletAddress, async () => {
    await checkForUnreleasedLocks();
  });

  watch(networkName, async () => {
    if (walletAddress.value) await checkForUnreleasedLocks();
  });
}

onMounted(async () => {
  await getNetworksLiquidity();
  if (walletAddress.value && !paramLockID) await checkForUnreleasedLocks();
  window.history.state.lockID = "";
});
</script>

<template>
  <div>
    <SearchComponent
      v-if="flowStep == Step.Search"
      @token-buy="confirmBuyClick"
    />
    <CustomAlert
      v-if="flowStep == Step.Search && showModal"
      :type="'redirect'"
      @close-alert="showModal = false"
      @go-to-lock="flowStep = Step.Buy"
    />
    <CustomAlert
      v-if="
        flowStep == Step.List && showBuyAlert && !loadingLock && !loadingRelease
      "
      :type="'buy'"
      @close-alert="showBuyAlert = false"
    />
    <div v-if="flowStep == Step.Buy">
      <QrCodeComponent
        :lockID="lockID"
        @pix-validated="releaseTransaction"
        v-if="!loadingLock"
      />
      <LoadingComponent
        v-if="loadingLock"
        :message="'A transação está sendo enviada para a rede'"
      />
    </div>
    <div v-if="flowStep == Step.List">
      <div class="flex flex-col gap-10" v-if="!loadingRelease">
        <BuyConfirmedComponent
          :tokenAmount="tokenAmount"
          :is-current-step="flowStep == Step.List"
          @make-another-transaction="flowStep = Step.Search"
        />
      </div>
      <LoadingComponent
        v-if="loadingRelease"
        :message="'A transação está sendo enviada para a rede. Em breve os tokens serão depositados em sua carteira.'"
      />
    </div>
  </div>
</template>

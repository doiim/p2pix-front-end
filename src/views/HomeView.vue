<script setup lang="ts">
import SearchComponent from '@/components/BuyerSteps/BuyerSearchComponent.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import BuyConfirmedComponent from '@/components/BuyerSteps/BuyConfirmedComponent.vue';
import { ref, onMounted, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import QrCodeComponent from '@/components/BuyerSteps/QrCodeComponent.vue';
import {
  addLock,
  releaseLock,
  LockIdUnrecoverableError,
} from '@/blockchain/buyerMethods';
import { updateWalletStatus, checkUnreleasedLock } from '@/blockchain/wallet';
import { isAmountNotAllowedError } from '@/blockchain/reputation';
import { useReputation } from '@/composables/useReputation';
import type { BuyPress, LimitChange } from '@/utils/reputation';
import { getNetworksLiquidity } from '@/blockchain/events';
import type { ValidDeposit } from '@/model/ValidDeposit';
import { getUnreleasedLockById } from '@/blockchain/events';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import type { Address, Hex } from 'viem';

enum Step {
  Search,
  Buy,
  List,
}

const user = useUser();
user.setSellerView(false);
const reputation = useReputation();

// States
const { loadingLock, walletAddress, network } = user;
const flowStep = ref<Step>(Step.Search);
const participantID = ref<string>();
const sellerAddress = ref<Address>();
const tokenAmount = ref<number>();
const lockID = ref<string>('');
const loadingRelease = ref<boolean>(false);
const showModal = ref<boolean>(false);
const showBuyAlert = ref<boolean>(false);
const showLockRecoveryAlert = ref<boolean>(false);
const paramLockID = window.history.state?.lockID;
// Set when the contract refused the lock with AmountNotAllowed: the search step reopens with that press.
const searchRefusal = ref<BuyPress | null>(null);
// The limit before and after the last release, for the purchase-complete screen; null when unknown or unchanged.
const newLimit = ref<LimitChange | null>(null);

// A refusal belongs to the search step it reopened: leaving that step (e.g. to resume a pending lock) drops it.
watch(flowStep, (step) => {
  if (step !== Step.Search) searchRefusal.value = null;
});

const confirmBuyClick = async (
  selectedDeposit: ValidDeposit,
  press: BuyPress,
) => {
  searchRefusal.value = null;
  participantID.value = selectedDeposit.participantID;
  tokenAmount.value = press.amount;

  if (selectedDeposit) {
    flowStep.value = Step.Buy;
    user.setLoadingLock(true);

    // Reset any lockID left over from a previous purchase so that, if addLock
    // throws LockIdUnrecoverableError and checkForUnreleasedLocks does not
    // recover an id, the `if (lockID.value)` check below does not mistake a
    // stale id from purchase #1 for a successful recovery of purchase #2.
    lockID.value = '';

    await addLock(selectedDeposit.seller, selectedDeposit.token, press.amount)
      .then((_lockID) => {
        lockID.value = String(_lockID);
      })
      .catch(async (err) => {
        console.error(err);
        if (err instanceof LockIdUnrecoverableError) {
          // The lock is funded on-chain: look it up instead of abandoning it.
          await checkForUnreleasedLocks().catch(console.error);
          if (lockID.value) {
            showModal.value = false;
          } else {
            // Without an id there is nothing for the QR step to render, so go
            // back to the search screen and say the lock is out there.
            flowStep.value = Step.Search;
            showLockRecoveryAlert.value = true;
          }
          return;
        }
        if (isAmountNotAllowedError(err)) {
          // Re-read while the loading screen is up, so the search step opens with the limit the
          // contract applied; at most 4 s, since nothing is being sent. A slower read keeps running
          // and the search step shows it land ("Verificando seu limite…", then R3).
          await reputation.refresh({ timeoutMs: 4000 });
          searchRefusal.value = press;
        }
        flowStep.value = Step.Search;
      });

    user.setLoadingLock(false);
  }
};

const releaseTransaction = async (params: {
  pixTimestamp: Hex;
  signature: Hex;
}) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  loadingRelease.value = true;
  newLimit.value = null;
  const beforeTokens = reputation.snapshot.value?.limitTokens ?? null;
  const networkName = network.value.name;

  try {
    const receipt = await releaseLock(
      BigInt(lockID.value),
      params.pixTimestamp,
      params.signature,
    );
    // Not awaited: the screen shows now and the line appears once the read lands. refresh() never rejects.
    void reputation.refresh({ minBlock: receipt.blockNumber }).then((read) => {
      newLimit.value =
        read.ok &&
        beforeTokens !== null &&
        read.snapshot.limitTokens !== beforeTokens
          ? {
              networkName,
              beforeTokens,
              afterTokens: read.snapshot.limitTokens,
            }
          : null;
    });

    try {
      await updateWalletStatus();
    } catch (err) {
      // Address/balance were cleared; the release itself already succeeded.
      console.error(err);
    }
  } catch (err) {
    console.log(err);
    showBuyAlert.value = false;
    flowStep.value = Step.Buy;
  } finally {
    loadingRelease.value = false;
  }
};

const checkForUnreleasedLocks = async (): Promise<void> => {
  if (!walletAddress.value) throw new Error('Wallet not connected');
  const lock = await checkUnreleasedLock(walletAddress.value);
  if (lock) {
    lockID.value = String(lock.lockID);
    tokenAmount.value = lock.amount;
    sellerAddress.value = lock.sellerAddress;
    showModal.value = true;
  } else {
    flowStep.value = Step.Search;
    showModal.value = false;
  }
};

if (paramLockID) {
  const lockToRedirect = await getUnreleasedLockById(paramLockID);
  if (lockToRedirect) {
    lockID.value = String(lockToRedirect.lockID);
    tokenAmount.value = lockToRedirect.amount;
    sellerAddress.value = lockToRedirect.sellerAddress;
    flowStep.value = Step.Buy;
  } else {
    flowStep.value = Step.Search;
  }
} else {
  watch(walletAddress, async () => {
    // A cleared address means updateWalletStatus either disconnected or failed
    // to resolve the smart-account address; either way there is no lock to
    // look up, so return early instead of running the query and surfacing a
    // spurious 'Wallet not connected' error from the watcher.
    if (!walletAddress.value) return;
    await checkForUnreleasedLocks().catch(console.error);
  });

  watch(network, async () => {
    if (walletAddress.value)
      await checkForUnreleasedLocks().catch(console.error);
  });
}

onMounted(async () => {
  await getNetworksLiquidity();
  if (walletAddress.value && !paramLockID) await checkForUnreleasedLocks();
  window.history.state.lockID = '';
});
</script>

<template>
  <div>
    <SearchComponent
      v-if="flowStep == Step.Search"
      :refusal="searchRefusal"
      @token-buy="confirmBuyClick"
    />
    <CustomAlert
      v-if="showLockRecoveryAlert"
      :type="'lockPending'"
      @close-alert="showLockRecoveryAlert = false"
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
          :new-limit="newLimit"
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

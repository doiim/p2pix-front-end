<script setup lang="ts">
import SearchComponent from '@/components/BuyerSteps/BuyerSearchComponent.vue';
import AccountLayout from '@/components/SmartAccount/AccountLayout.vue';
import ActivityTab from '@/components/SmartAccount/ActivityTab.vue';
import OfferTabs from '@/components/SmartAccount/OfferTabs.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import BuyConfirmedComponent from '@/components/BuyerSteps/BuyConfirmedComponent.vue';
import { ref, onMounted, watch, computed } from 'vue';
import { useUser } from '@/composables/useUser';
import { useWalletAddress } from '@/queries/wallet';
import QrCodeComponent from '@/components/BuyerSteps/QrCodeComponent.vue';
import { LockIdUnrecoverableError } from '@/blockchain/buyerMethods';
import { checkUnreleasedLock } from '@/blockchain/wallet';
import { isAmountNotAllowedError } from '@/blockchain/reputation';
import { useReputation } from '@/composables/useReputation';
import type { BuyPress, LimitChange } from '@/utils/reputation';
import { getUnreleasedLockById } from '@/blockchain/events';
import {
  useAddLockMutation,
  useReleaseLockMutation,
} from '@/queries/mutations';
import { queryClient } from '@/queries/client';
import { lockKey, queryKeyRoots } from '@/queries/keys';
import type { ValidDeposit } from '@/model/ValidDeposit';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import type { Address } from 'viem';
import type { PixProof } from '@/utils/pixProof';

enum Step {
  Search,
  Buy,
  List,
}

const user = useUser();
user.setSellerView(false);
const reputation = useReputation();

// States
const { network } = user;
const walletAddress = useWalletAddress();
const addLockMutation = useAddLockMutation();
const releaseLockMutation = useReleaseLockMutation();
const loadingLock = computed(() => addLockMutation.isPending.value);
const loadingRelease = computed(() => releaseLockMutation.isPending.value);
const flowStep = ref<Step>(Step.Search);
const sellerAddress = ref<Address>();
const tokenAmount = ref<number>();
const lockID = ref<string>('');
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
  tokenAmount.value = press.amount;
  flowStep.value = Step.Buy;

  // Reset any lockID left over from a previous purchase so that, if addLock
  // throws LockIdUnrecoverableError and checkForUnreleasedLocks does not
  // recover an id, the `if (lockID.value)` check below does not mistake a
  // stale id from purchase #1 for a successful recovery of purchase #2.
  lockID.value = '';

  try {
    const newLockID = await addLockMutation.mutateAsync({
      sellerAddress: selectedDeposit.seller,
      tokenAddress: selectedDeposit.token,
      amount: press.amount,
    });
    lockID.value = String(newLockID);
  } catch (err) {
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
  }
};

const releaseTransaction = async (proof: PixProof) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  newLimit.value = null;
  const beforeTokens = reputation.snapshot.value?.limitTokens ?? null;
  const networkName = network.value.name;

  try {
    const receipt = await releaseLockMutation.mutateAsync({
      lockID: BigInt(lockID.value),
      proof,
    });
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
  } catch (err) {
    console.log(err);
    showBuyAlert.value = false;
    flowStep.value = Step.Buy;
  }
};

const checkForUnreleasedLocks = async (): Promise<void> => {
  const address = walletAddress.value;
  if (!address) throw new Error('Carteira não conectada');
  const lock = await queryClient.fetchQuery({
    queryKey: [...queryKeyRoots.unreleasedLock, network.value.id, address],
    queryFn: () => checkUnreleasedLock(address, network.value),
    // This is the recovery read after a funded-but-id-less lock, so it has to
    // reach the chain: with the default staleTime a warm entry (the check that
    // ran when the address was resolved) would be returned as-is and the id
    // would never be found.
    staleTime: 0,
  });
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
  const lockToRedirect = await queryClient.fetchQuery({
    queryKey: lockKey(network.value.id, paramLockID),
    queryFn: () => getUnreleasedLockById(BigInt(paramLockID), network.value),
  });
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
    // A cleared address means the effective-address resolution either
    // disconnected or failed; either way there is no lock to look up, so
    // return early instead of running the query and surfacing a spurious
    // 'Carteira não conectada' error from the watcher.
    if (!walletAddress.value) return;
    await checkForUnreleasedLocks().catch(console.error);
  });

  watch(network, async () => {
    if (walletAddress.value)
      await checkForUnreleasedLocks().catch(console.error);
  });
}

onMounted(async () => {
  if (walletAddress.value && !paramLockID) await checkForUnreleasedLocks();
});
</script>

<template>
  <div>
    <AccountLayout v-if="flowStep == Step.Search" :selling="false">
      <SearchComponent :refusal="searchRefusal" @token-buy="confirmBuyClick">
        <OfferTabs />
        <template #footer><ActivityTab /></template>
      </SearchComponent>
    </AccountLayout>
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

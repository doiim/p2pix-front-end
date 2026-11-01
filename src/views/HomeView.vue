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
  invalidateLocks,
  useAddLockMutation,
  useReleaseLockMutation,
} from '@/queries/mutations';
import { queryClient } from '@/queries/client';
import { lockKey, queryKeyRoots } from '@/queries/keys';
import type { ValidDeposit } from '@/model/ValidDeposit';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import {
  loadSwapIntent,
  releaseAndSwap,
  saveSwapIntent,
  separatePrompts,
  type SwapIntent,
} from '@/blockchain/swap';
import { promptsNotice } from '@/utils/walletPrompts';
import { TokenEnum } from '@/model/NetworkEnum';
import type { Address, Hex } from 'viem';
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
// The swap release bypasses the mutation, so it has its own flag.
const swapReleasing = ref(false);
const loadingRelease = computed(
  () => releaseLockMutation.isPending.value || swapReleasing.value,
);
const flowStep = ref<Step>(Step.Search);

// The hero follows the step; the account panel stays beside the offer card.
const hero = computed(() => {
  if (flowStep.value === Step.Buy) {
    return loadingLock.value
      ? { title: undefined, subtitle: undefined }
      : {
          title: 'Utilize o QR Code ou copie o código para realizar o Pix',
          subtitle:
            'Após realizar o Pix no banco de sua preferência, clique no botão abaixo para liberação dos tokens.',
        };
  }
  if (flowStep.value === Step.List) {
    return loadingRelease.value
      ? { title: undefined, subtitle: undefined }
      : {
          title: 'Os tokens já foram transferidos para a sua carteira!',
          subtitle: '',
        };
  }
  return { title: undefined, subtitle: undefined };
});
const sellerAddress = ref<Address>();
const tokenAmount = ref<number>();
const lockID = ref<string>('');
const showModal = ref<boolean>(false);
// The Pix warning shows each time the QR step opens (new lock or resumed one).
const showPixWarning = ref<boolean>(true);
watch(flowStep, (step) => {
  if (step === Step.Buy) showPixWarning.value = true;
});
const showBuyAlert = ref<boolean>(false);
const showLockRecoveryAlert = ref<boolean>(false);
const swapResult = ref<{ uid: Hex | null; token: string }>();
const releaseNotice = ref<string | null>(null);
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
  swapIntent?: SwapIntent,
) => {
  searchRefusal.value = null;
  tokenAmount.value = press.amount;
  swapResult.value = undefined;
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
      skipAllowlist: press.skipAllowlist,
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
  } finally {
    if (swapIntent && lockID.value) saveSwapIntent(lockID.value, swapIntent);
  }
};

const releaseTransaction = async (proof: PixProof) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  newLimit.value = null;
  const beforeTokens = reputation.snapshot.value?.limitTokens ?? null;
  const networkName = network.value.name;

  try {
    const intent = loadSwapIntent(lockID.value);
    releaseNotice.value = intent
      ? promptsNotice(await separatePrompts(true), {
          sell: TokenEnum.BRZ,
          buy: intent.token,
        })
      : null;
    let released: { uid: Hex | null; blockNumber: bigint };
    if (intent) {
      swapReleasing.value = true;
      try {
        released = await releaseAndSwap(BigInt(lockID.value), proof, intent);
      } finally {
        swapReleasing.value = false;
      }
      // The swap path bypasses the release mutation, so invalidate here.
      invalidateLocks();
      swapResult.value = { uid: released.uid, token: intent.token };
    } else {
      const receipt = await releaseLockMutation.mutateAsync({
        lockID: BigInt(lockID.value),
        proof,
      });
      released = { uid: null, blockNumber: receipt.blockNumber };
    }
    // Not awaited: the screen shows now and the line appears once the read lands. refresh() never rejects.
    void reputation.refresh({ minBlock: released.blockNumber }).then((read) => {
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
    queryFn: () => getUnreleasedLockById(BigInt(paramLockID)),
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
    <AccountLayout
      :selling="false"
      :title="hero.title"
      :subtitle="hero.subtitle"
    >
      <template #banner>
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
          v-if="flowStep == Step.Buy && !loadingLock && showPixWarning"
          :type="'pixWarning'"
          @close-alert="showPixWarning = false"
        />
        <CustomAlert
          v-if="
            flowStep == Step.List &&
            showBuyAlert &&
            !loadingLock &&
            !loadingRelease
          "
          :type="'buy'"
          @close-alert="showBuyAlert = false"
        />
      </template>
      <SearchComponent
        v-if="flowStep == Step.Search"
        :refusal="searchRefusal"
        @token-buy="confirmBuyClick"
      >
        <OfferTabs />
        <template #footer><ActivityTab /></template>
      </SearchComponent>
      <template v-if="flowStep == Step.Buy">
        <QrCodeComponent
          v-if="!loadingLock"
          :lockID="lockID"
          embedded
          @pix-validated="releaseTransaction"
        />
        <LoadingComponent
          v-else
          embedded
          :message="'A transação está sendo enviada para a rede'"
        />
      </template>
      <template v-if="flowStep == Step.List">
        <BuyConfirmedComponent
          v-if="!loadingRelease"
          :tokenAmount="tokenAmount"
          :new-limit="newLimit"
          :swap="swapResult"
          embedded
          @make-another-transaction="flowStep = Step.Search"
        />
        <LoadingComponent
          v-else
          embedded
          :message="
            releaseNotice ??
            'A transação está sendo enviada para a rede. Em breve os tokens serão depositados em sua carteira.'
          "
        />
      </template>
    </AccountLayout>
  </div>
</template>

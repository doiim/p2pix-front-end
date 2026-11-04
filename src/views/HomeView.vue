<script setup lang="ts">
import SearchComponent from '@/components/BuyerSteps/BuyerSearchComponent.vue';
import AccountLayout from '@/components/SmartAccount/AccountLayout.vue';
import ActivityTab from '@/components/SmartAccount/ActivityTab.vue';
import OfferTabs from '@/components/SmartAccount/OfferTabs.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import BuyConfirmedComponent from '@/components/BuyerSteps/BuyConfirmedComponent.vue';
import { ref, onMounted, watch, computed } from 'vue';
import { useUser } from '@/composables/useUser';
import { usePasskeyAccount } from '@/composables/usePasskeyAccount';
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
  clearSwapIntent,
  loadSwapIntent,
  releaseAndSwap,
  saveSwapIntent,
  separatePrompts,
  type SwapIntent,
} from '@/blockchain/swap';
import { promptsNotice } from '@/utils/walletPrompts';
import { brzOnlyText, type SwapFailure } from '@/utils/swapFailure';
import { TokenEnum } from '@/model/NetworkEnum';
import type { Address, Hex } from 'viem';
import { releaseErrorMessage, type PixProof } from '@/utils/pixProof';
import { reservationLabel } from '@/utils/reservation';
import { useLeaveGuard } from '@/composables/useLeaveGuard';

enum Step {
  Search,
  Buy,
  List,
}

const user = useUser();
const account = usePasskeyAccount();
// A smart account signs on its own: nothing to confirm in a wallet while it sends.
const loadingTitle = computed(() =>
  account.isSmartAccount.value ? 'Enviando para a rede' : undefined,
);
user.setSellerView(false);
const reputation = useReputation();

// States
const { network } = user;
const walletAddress = useWalletAddress();
const addLockMutation = useAddLockMutation();
const releaseLockMutation = useReleaseLockMutation();
const loadingLock = computed(() => addLockMutation.isPending.value);
// The Buy step opens before addLock starts: until the lock has an id there is no Pix to show.
const waitingLock = computed(() => loadingLock.value || !lockID.value);
// The swap release bypasses the mutation, so it has its own flag.
const swapReleasing = ref(false);
const loadingRelease = computed(
  () => releaseLockMutation.isPending.value || swapReleasing.value,
);
const flowStep = ref<Step>(Step.Search);
// Closing or reloading while the release is in flight would hide its outcome.
useLeaveGuard(loadingRelease);

// The hero follows the step; the account panel stays beside the offer card.
const hero = computed(() => {
  if (flowStep.value === Step.Buy) {
    // While loading, say what is happening instead of falling back to the search hero.
    return waitingLock.value
      ? { title: 'Reservando a oferta', subtitle: '' }
      : {
          title: 'Utilize o QR Code ou copie o código para realizar o Pix',
          subtitle:
            'Após realizar o Pix no banco de sua preferência, clique no botão abaixo para liberação dos tokens.',
        };
  }
  if (flowStep.value === Step.List) {
    return loadingRelease.value
      ? { title: 'Liberando seus tokens', subtitle: '' }
      : {
          title: 'Os tokens já foram transferidos para a sua carteira!',
          subtitle: '',
        };
  }
  return { title: undefined, subtitle: undefined };
});
const sellerAddress = ref<Address>();
const tokenAmount = ref<number>();
const lockToken = ref<Address>();
// What the open-purchase banner names; the lock's network is the selected one there.
const openPurchase = computed(() =>
  lockToken.value && tokenAmount.value !== undefined
    ? reservationLabel(network.value, {
        lockID: lockID.value,
        amount: tokenAmount.value,
        token: lockToken.value,
      })
    : undefined,
);
const lockID = ref<string>('');
const showModal = ref<boolean>(false);
// The Pix warning shows each time the QR step opens (new lock or resumed one).
const showPixWarning = ref<boolean>(true);
watch(flowStep, (step) => {
  if (step === Step.Buy) showPixWarning.value = true;
});
const showBuyAlert = ref<boolean>(false);
const showLockRecoveryAlert = ref<boolean>(false);
const swapResult = ref<{ uid: Hex | null; token: string; failure?: string }>();
const releaseNotice = ref<string | null>(null);
const stateLockID: unknown = window.history.state?.lockID;
// history.state is not ours to trust: anything but a plain lock id opens the search step.
const paramLockID =
  (typeof stateLockID === 'string' || typeof stateLockID === 'number') &&
  /^\d+$/.test(String(stateLockID))
    ? String(stateLockID)
    : undefined;
// Set when the contract refused the lock with AmountNotAllowed: the search step reopens with that press.
const searchRefusal = ref<BuyPress | null>(null);
// The limit before and after the last release, for the purchase-complete screen; null when unknown or unchanged.
const newLimit = ref<LimitChange | null>(null);

// A refusal belongs to the search step it reopened: leaving that step (e.g. to resume a pending lock) drops it.
watch(flowStep, (step) => {
  if (step === Step.Search) return;
  searchRefusal.value = null;
  // The open-purchase alert belongs to the search step; it must not wait there for the next visit.
  showModal.value = false;
});

const confirmBuyClick = async (
  selectedDeposit: ValidDeposit,
  press: BuyPress,
  swapIntent?: SwapIntent,
) => {
  searchRefusal.value = null;
  tokenAmount.value = press.amount;
  swapResult.value = undefined;
  // Reset any lockID left over from a previous purchase so that, if addLock
  // throws LockIdUnrecoverableError and checkForUnreleasedLocks does not
  // recover an id, the `if (lockID.value)` check below does not mistake a
  // stale id from purchase #1 for a successful recovery of purchase #2.
  // Cleared before the step changes: the QR step waits for an id (waitingLock).
  lockID.value = '';
  flowStep.value = Step.Buy;

  try {
    const newLockID = await addLockMutation.mutateAsync({
      sellerAddress: selectedDeposit.seller,
      tokenAddress: selectedDeposit.token,
      amount: press.wei,
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
    } else {
      user.showToast('error', releaseErrorMessage(err));
    }
    flowStep.value = Step.Search;
  } finally {
    if (swapIntent && lockID.value)
      saveSwapIntent(selectedDeposit.network.id, lockID.value, swapIntent);
  }
};

const releaseTransaction = async (proof: PixProof) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  newLimit.value = null;
  const beforeTokens = reputation.snapshot.value?.limitTokens ?? null;
  const networkName = network.value.name;

  try {
    const intent = loadSwapIntent(network.value.id, lockID.value);
    releaseNotice.value = null;
    let released: {
      uid: Hex | null;
      blockNumber: bigint;
      failure?: SwapFailure;
    };
    if (intent) {
      // Loading from the first await: before this, the step showed the receipt of a release not yet sent.
      swapReleasing.value = true;
      try {
        releaseNotice.value = promptsNotice(
          await separatePrompts(true).catch(() => []),
          { sell: TokenEnum.BRZ, buy: intent.token },
        );
        released = await releaseAndSwap(BigInt(lockID.value), proof, intent);
      } finally {
        swapReleasing.value = false;
      }
      // The swap path bypasses the release mutation, so invalidate here. The release is done:
      // a failed refresh must not turn it into an error screen.
      await invalidateLocks().catch(console.error);
      swapResult.value = {
        uid: released.uid,
        token: intent.token,
        failure: released.failure
          ? brzOnlyText(released.failure, intent.token)
          : undefined,
      };
    } else {
      const receipt = await releaseLockMutation.mutateAsync({
        lockID: BigInt(lockID.value),
        proof,
      });
      released = { uid: null, blockNumber: receipt.blockNumber };
    }
    clearSwapIntent(network.value.id, lockID.value);
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
    console.error(err);
    user.showToast('error', releaseErrorMessage(err));
    showBuyAlert.value = false;
    flowStep.value = Step.Buy;
  }
};

// "Sim" answers the alert: once resumed it must not come back when this purchase completes.
const resumeLock = () => {
  showModal.value = false;
  flowStep.value = Step.Buy;
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
    lockToken.value = lock.tokenAddress;
    sellerAddress.value = lock.sellerAddress;
    showModal.value = flowStep.value === Step.Search;
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
    lockToken.value = lockToRedirect.tokenAddress;
    sellerAddress.value = lockToRedirect.sellerAddress;
    flowStep.value = Step.Buy;
  } else {
    flowStep.value = Step.Search;
  }
} else {
  // A lock being created or a release on its way owns the screen: a
  // wallet or network event then must not move the flow or swap the lock.
  const flowBusy = () =>
    flowStep.value === Step.List ||
    (flowStep.value === Step.Buy && !lockID.value);

  watch(walletAddress, async () => {
    // A cleared address means the effective-address resolution either
    // disconnected or failed; either way there is no lock to look up, so
    // return early instead of running the query and surfacing a spurious
    // 'Carteira não conectada' error from the watcher.
    if (!walletAddress.value || flowBusy()) return;
    await checkForUnreleasedLocks().catch(console.error);
  });

  watch(network, async () => {
    if (walletAddress.value && !flowBusy())
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
          :detail="openPurchase"
          @close-alert="showModal = false"
          @go-to-lock="resumeLock"
        />
        <CustomAlert
          v-if="flowStep == Step.Buy && !waitingLock && showPixWarning"
          :type="'pixWarning'"
          @close-alert="showPixWarning = false"
        />
        <CustomAlert v-if="loadingRelease" :type="'releasing'" />
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
          v-if="!waitingLock"
          :lockID="lockID"
          embedded
          @pix-validated="releaseTransaction"
          @back="flowStep = Step.Search"
        />
        <LoadingComponent
          v-else
          embedded
          :title="loadingTitle"
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
          :title="loadingTitle"
          :message="
            releaseNotice ??
            'A transação está sendo enviada para a rede. Em breve os tokens serão depositados em sua carteira.'
          "
        />
      </template>
    </AccountLayout>
  </div>
</template>

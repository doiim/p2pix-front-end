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
import { getNetworksLiquidity } from '@/blockchain/events';
import type { ValidDeposit } from '@/model/ValidDeposit';
import { getUnreleasedLockById } from '@/blockchain/events';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import { getPrices } from '@/utils/bbPay';
import AccountPanel from '@/components/Account/AccountPanel.vue';
import AccountTransactions from '@/components/Account/AccountTransactions.vue';
import SellerComponent from '@/components/SellerSteps/SellerComponent.vue';
import { approveTokens, addDeposit } from '@/blockchain/sellerMethods';
import type { Participant } from '@/utils/bbPay';
import { useRoute, useRouter } from 'vue-router';
import type { Address, Hex } from 'viem';

enum Step {
  Search,
  Buy,
  List,
  Sell,
}

const user = useUser();
const router = useRouter();
// "/seller" is this page in sell mode; switching modes changes the route,
// which remounts the view.
const selling = useRoute().name === 'seller';
user.setSellerView(selling);

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
const showSellAlert = ref<boolean>(false);
const sales = ref(0);
const paramLockID = window.history.state?.lockID;

const confirmBuyClick = async (
  selectedDeposit: ValidDeposit,
  tokenValue: number,
) => {
  participantID.value = selectedDeposit.participantID;
  tokenAmount.value = tokenValue;

  if (selectedDeposit) {
    flowStep.value = Step.Buy;
    user.setLoadingLock(true);

    // Reset any lockID left over from a previous purchase so that, if addLock
    // throws LockIdUnrecoverableError and checkForUnreleasedLocks does not
    // recover an id, the `if (lockID.value)` check below does not mistake a
    // stale id from purchase #1 for a successful recovery of purchase #2.
    lockID.value = '';

    await addLock(selectedDeposit.seller, selectedDeposit.token, tokenValue)
      .then((_lockID) => {
        lockID.value = String(_lockID);
      })
      .catch(async (err) => {
        console.log(err);
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
        flowStep.value = Step.Search;
      });

    user.setLoadingLock(false);
  }
};

const confirmSellClick = async (participant: Participant) => {
  if (!user.network.value.tokens[user.selectedToken.value]) {
    user.showToast(
      'error',
      `${user.selectedToken.value} ainda não está disponível nesta rede`,
    );
    return;
  }
  flowStep.value = Step.Sell;
  await approveTokens(participant)
    .then(() => addDeposit(participant))
    .then(() => {
      showSellAlert.value = true;
      sales.value++;
    })
    .catch((cause) => {
      console.error(cause);
      user.showToast('error', 'Não foi possível enviar a oferta para a rede.');
    });
  flowStep.value = Step.Search;
};

// A lock being resumed can switch the token too, not just the picker.
watch(user.selectedToken, () => getNetworksLiquidity().catch(console.error));

const releaseTransaction = async (params: {
  pixTimestamp: Hex;
  signature: Hex;
}) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  loadingRelease.value = true;

  try {
    await releaseLock(
      BigInt(lockID.value),
      params.pixTimestamp,
      params.signature,
    );

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
    user.setSelectedToken(lock.token);
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
    user.setSelectedToken(lockToRedirect.token);
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
  getPrices().then(user.setPrices).catch(console.error);
  await getNetworksLiquidity();
  if (walletAddress.value && !paramLockID) await checkForUnreleasedLocks();
  window.history.state.lockID = '';
});
</script>

<template>
  <div>
    <!-- Hidden, not unmounted, while selling: a failed sale keeps the filled
         form, and a completed one remounts it empty with fresh balances. -->
    <div
      v-if="flowStep == Step.Search || flowStep == Step.Sell"
      v-show="flowStep == Step.Search"
      :key="sales"
      class="mt-10 sm:mt-16"
    >
      <div class="flex flex-col items-center gap-4 text-white text-center">
        <span
          class="font-extrabold sm:text-5xl text-3xl sm:max-w-[29rem] max-w-[20rem]"
        >
          {{
            selling
              ? 'Venda cripto e receba em Pix'
              : 'Adquira cripto com apenas um Pix'
          }}</span
        >
        <span class="font-medium sm:text-base text-sm max-w-[28rem]">{{
          selling
            ? 'Digite um valor, escolha o token e envie sua oferta para a rede'
            : 'Digite um valor, confira a oferta, conecte sua carteira e receba os tokens após realizar o Pix'
        }}</span>
      </div>
      <!-- Reversed so the balances sit left of the buy card on wide screens
           and below it, after the transactions, when the row wraps. -->
      <div
        class="flex flex-row-reverse flex-wrap justify-center items-start gap-x-6"
      >
        <div class="flex flex-col items-center w-full md:max-w-lg">
          <component
            :is="selling ? SellerComponent : SearchComponent"
            @token-buy="confirmBuyClick"
            @approve-tokens="confirmSellClick"
          >
            <div
              role="group"
              aria-label="Tipo de oferta"
              class="grid grid-cols-2 gap-2 w-full"
            >
              <button
                v-for="option in [
                  { route: 'home', label: 'Comprar', sell: false },
                  { route: 'seller', label: 'Vender', sell: true },
                ]"
                :key="option.route"
                type="button"
                :aria-pressed="option.sell === selling"
                class="min-h-11 rounded-lg border font-semibold"
                :class="
                  option.sell === selling
                    ? 'bg-white border-white text-gray-900'
                    : 'border-gray-500 text-white'
                "
                @click="router.push({ name: option.route })"
              >
                {{ option.label }}
              </button>
            </div>
            <template #footer><AccountTransactions /></template>
          </component>
        </div>
        <AccountPanel />
      </div>
    </div>
    <CustomAlert
      v-if="showLockRecoveryAlert"
      :type="'lockPending'"
      @close-alert="showLockRecoveryAlert = false"
    />
    <CustomAlert
      v-if="flowStep == Step.Search && showSellAlert"
      :type="'sell'"
      @close-alert="showSellAlert = false"
    />
    <LoadingComponent
      v-if="flowStep == Step.Sell"
      :message="'A transação está sendo enviada para a rede.'"
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

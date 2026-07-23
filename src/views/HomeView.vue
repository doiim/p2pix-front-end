<script setup lang="ts">
import SearchComponent from '@/components/BuyerSteps/BuyerSearchComponent.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import BuyConfirmedComponent from '@/components/BuyerSteps/BuyConfirmedComponent.vue';
import { ref, onMounted, watch } from 'vue';
import { useUser } from '@/composables/useUser';
import QrCodeComponent from '@/components/BuyerSteps/QrCodeComponent.vue';
import {
  prepareLock,
  prepareRelease,
  submitLock,
  submitRelease,
} from '@/blockchain/buyerMethods';
import { updateWalletStatus, checkUnreleasedLock } from '@/blockchain/wallet';
import { getNetworksLiquidity } from '@/blockchain/events';
import type { ValidDeposit } from '@/model/ValidDeposit';
import { getUnreleasedLockById } from '@/blockchain/events';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import type { ReleaseAuthorization } from '@/utils/bbPay';
import { getErrorMessage } from '@/utils/error';
import { formatUnits, type Address, type Hex } from 'viem';

enum Step {
  Search,
  Buy,
  List,
}

const user = useUser();
user.setSellerView(false);

// States
const { loadingLock, walletAddress, network } = user;
const flowStep = ref<Step>(Step.Search);
const participantID = ref<string>();
const sellerAddress = ref<Address>();
const tokenAmount = ref<number>();
const lockID = ref<string>('');
const orderId = ref<Hex>();
const loadingRelease = ref<boolean>(false);
const showModal = ref<boolean>(false);
const showBuyAlert = ref<boolean>(false);
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

    try {
      const prepared = await prepareLock(
        selectedDeposit.seller,
        selectedDeposit.token,
        tokenValue,
      );

      const confirmed =
        prepared.policy === 'sponsored'
          ? window.confirm(
              'Primeiro lock elegível: deployment da smart account e lock serão patrocinados, sem débito no seu saldo. Confirmar compra?',
            )
          : prepared.policy === 'erc20' && prepared.quote
            ? window.confirm(
                `Custo máximo desta operação: ${prepared.quote.formattedToken} em ERC-20, aproximadamente US$ ${prepared.quote.formattedUsd}. Confirmar compra?`,
              )
            : window.confirm(
                'Esta carteira externa pagará o gas da operação em moeda nativa. Confirmar compra?',
              );
      if (!confirmed) {
        flowStep.value = Step.Search;
        return;
      }

      const submission = await submitLock(prepared);
      lockID.value = String(submission.lockID);
      orderId.value = submission.orderId;
    } catch (error) {
      console.error(error);
      window.alert(
        getErrorMessage(error, 'Não foi possível criar o lock antes do PIX.'),
      );
      flowStep.value = Step.Search;
    } finally {
      user.setLoadingLock(false);
    }
  }
};

const releaseTransaction = async (authorization: ReleaseAuthorization) => {
  flowStep.value = Step.List;
  showBuyAlert.value = true;
  loadingRelease.value = true;

  try {
    const prepared = await prepareRelease(BigInt(lockID.value), authorization);
    if (prepared.policy === 'erc20' && prepared.quote) {
      const netAmount = formatUnits(
        prepared.lock.amount - prepared.quote.costInToken,
        prepared.quote.tokenDecimals,
      );
      const confirmed = window.confirm(
        `Liberação paga em ERC-20: custo máximo ${prepared.quote.formattedToken} (aprox. US$ ${prepared.quote.formattedUsd}); recebimento líquido mínimo estimado ${netAmount}. Confirmar?`,
      );
      if (!confirmed) {
        flowStep.value = Step.Buy;
        return;
      }
    }

    await submitRelease(prepared);
    await updateWalletStatus();
  } catch (error) {
    console.error(error);
    window.alert(getErrorMessage(error, 'Não foi possível liberar os tokens.'));
    flowStep.value = Step.Buy;
  } finally {
    loadingRelease.value = false;
  }
};

const handleQrError = (message: string) => {
  window.alert(message || 'Não foi possível gerar o PIX.');
  flowStep.value = Step.Search;
};

const checkForUnreleasedLocks = async (): Promise<void> => {
  if (!walletAddress.value) throw new Error('Wallet not connected');
  const lock = await checkUnreleasedLock(walletAddress.value);
  if (lock) {
    lockID.value = String(lock.lockID);
    orderId.value = undefined;
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
    orderId.value = undefined;
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

  watch(network, async () => {
    if (walletAddress.value) await checkForUnreleasedLocks();
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
        :orderID="orderId"
        @pix-validated="releaseTransaction"
        @error="handleQrError"
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

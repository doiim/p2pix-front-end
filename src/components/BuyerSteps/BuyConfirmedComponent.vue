<script setup lang="ts">
import { withdrawDeposit } from '@/blockchain/buyerMethods';
import {
  getCurrentAccount,
  getPublicClient,
  getWalletClient,
} from '@/blockchain/provider';
import {
  getSellerLockState,
  listAllTransactionByWalletAddress,
  listValidDepositTransactionsByWalletAddress,
} from '@/blockchain/wallet';
import CustomButton from '@/components/ui/CustomButton.vue';
import type { ValidDeposit } from '@/model/ValidDeposit';
import type { WalletTransaction } from '@/model/WalletTransaction';
import { useUser } from '@/composables/useUser';
import { computed, onMounted, ref, watch } from 'vue';
import ListingComponent from '@/components/ListingComponent/ListingComponent.vue';
import ReputationNewLimitLine from '@/components/BuyerSteps/Reputation/ReputationNewLimitLine.vue';
import type { LimitChange } from '@/utils/reputation';
import SwapOrderStatus from '@/components/Swap/SwapOrderStatus.vue';
import { cancelSwap, requoteSwap } from '@/blockchain/swap';
import { findSwapToken } from '@/model/BuyToken';
import { TokenEnum } from '@/model/NetworkEnum';
import { erc20Abi, parseEther, UserRejectedRequestError, type Hex } from 'viem';

// props
const props = defineProps<{
  tokenAmount: number | undefined;
  isCurrentStep: boolean;
  newLimit: LimitChange | null;
  /** Present when the buyer asked for another token after the release. */
  swap?: { uid: Hex | null; token: string };
}>();

const user = useUser();
const { walletAddress } = useUser();

const lastWalletTransactions = ref<WalletTransaction[]>([]);
const depositList = ref<ValidDeposit[]>([]);
const activeLockAmount = ref<number>(0);
const isWatchingToken = ref(false);
const watchTokenAlert = ref<{
  type: 'success' | 'error';
  message: string;
} | null>(null);

// methods

const getWalletTransactions = async () => {
  user.setLoadingWalletTransactions(true);
  if (walletAddress.value) {
    const walletDeposits = await listValidDepositTransactionsByWalletAddress(
      walletAddress.value,
    );

    const allUserTransactions = await listAllTransactionByWalletAddress(
      walletAddress.value,
    );

    activeLockAmount.value = (
      await getSellerLockState(walletAddress.value)
    ).activeLockAmount;

    if (walletDeposits) {
      depositList.value = walletDeposits;
    }
    if (allUserTransactions) {
      lastWalletTransactions.value = allUserTransactions;
    }
  }
  user.setLoadingWalletTransactions(false);
};

const callWithdraw = async (amount: string) => {
  if (amount) {
    user.setLoadingWalletTransactions(true);
    const withdraw = await withdrawDeposit(
      amount,
      user.network.value.tokens[user.selectedToken.value].address,
    );
    if (withdraw) {
      console.log('Saque realizado!');
      await getWalletTransactions();
    } else {
      console.log('Não foi possível realizar o saque!');
    }
    user.setLoadingWalletTransactions(false);
  }
};

const watchToken = async () => {
  const token = user.network.value.tokens[user.selectedToken.value];
  const chainId = user.network.value.id;
  const walletClient = await getWalletClient();

  if (!walletClient) {
    watchTokenAlert.value = {
      type: 'error',
      message:
        'Carteira não disponível. Conecte uma carteira e tente novamente.',
    };
    return;
  }

  isWatchingToken.value = true;
  watchTokenAlert.value = null;
  try {
    // `wallet_watchAsset` registers against whatever chain the wallet is
    // actually on, so make sure it matches the token's chain first — otherwise
    // the user gets a phantom token for the wrong network.
    if (getCurrentAccount().chainId !== chainId) {
      await walletClient.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chainId.toString(16)}` }],
      });
    }

    // Read symbol/decimals from the token itself — the chain is the source of
    // truth, and a wrong decimals in watchAsset renders every wallet balance
    // scaled wrong, permanently (EIP-747 has no unregister).
    const client = getPublicClient();
    const [symbol, decimals] = await Promise.all([
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      client.readContract({
        address: token.address,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
    ]);

    await walletClient.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: token.address,
          symbol,
          decimals,
        },
      },
    });
    watchTokenAlert.value = {
      type: 'success',
      message: `Token ${user.selectedToken.value} cadastrado na carteira.`,
    };
  } catch (error) {
    // 4001 is the user declining in their wallet, not a failure.
    const rejected =
      error instanceof UserRejectedRequestError ||
      (typeof error === 'object' &&
        error !== null &&
        (error as { code?: number }).code === 4001);
    watchTokenAlert.value = {
      type: 'error',
      message: rejected
        ? 'Cadastro do token cancelado.'
        : 'Não foi possível cadastrar o token. Tente novamente.',
    };
  } finally {
    isWatchingToken.value = false;
  }
};

// Emits
const emit = defineEmits(['makeAnotherTransaction']);

const swapToken = computed(() =>
  props.swap ? findSwapToken(user.network.value, props.swap.token) : undefined,
);
const brzAddress = computed(
  () => user.network.value.tokens[TokenEnum.BRZ].address,
);
const requoteBought = () =>
  props.tokenAmount
    ? requoteSwap(
        props.swap?.token ?? '',
        parseEther(String(props.tokenAmount)),
      )
    : Promise.reject(new Error('No purchase amount to swap'));
const keepBrz = (uid: Hex) => cancelSwap(uid, brzAddress.value);

// observer
// Not `watch(props)`: the late `newLimit` update must not re-run the subgraph and RPC reads.
watch(
  [() => props.tokenAmount, () => props.isCurrentStep],
  async (): Promise<void> => {
    if (props.isCurrentStep) await getWalletTransactions();
  },
);

onMounted(async () => {
  await getWalletTransactions();
});
</script>

<template>
  <div class="page">
    <div class="text-container">
      <span class="text font-extrabold sm:text-5xl text-xl max-w-[50rem]"
        >Os tokens já foram transferidos <br />
        para a sua carteira!
      </span>
    </div>
    <div class="main-container">
      <div class="flex flex-col w-full bg-white px-10 py-5 rounded-lg">
        <div>
          <p>Tokens recebidos</p>
          <p class="text-2xl text-gray-900">
            {{ props.tokenAmount }} {{ user.selectedToken }}
          </p>
          <ReputationNewLimitLine
            v-if="props.newLimit"
            v-bind="props.newLimit"
          />
        </div>
        <div class="my-5">
          <p class="text-sm">
            <b>Não encontrou os tokens? </b><br />Clique no botão abaixo para
            <br />
            cadastrar o {{ user.selectedToken }} em sua carteira.
          </p>
        </div>
        <CustomButton
          :text="'Cadastrar token'"
          :loading="isWatchingToken"
          @buttonClicked="watchToken"
        />
        <div
          v-if="watchTokenAlert"
          class="mt-3 p-3 rounded text-sm text-center"
          :class="
            watchTokenAlert.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-700'
          "
        >
          {{ watchTokenAlert.message }}
        </div>
      </div>
      <SwapOrderStatus
        v-if="props.swap && swapToken"
        :order-uid="props.swap.uid"
        :token="swapToken.symbol"
        :token-address="swapToken.address"
        :keep="TokenEnum.BRZ"
        :requote="requoteBought"
        :cancel="keepBrz"
      />
      <button
        type="button"
        class="border-amber-500 border-2 rounded default-button text-white p-2 px-50 min-w-[198px]"
        @click="emit('makeAnotherTransaction')"
      >
        Fazer nova transação
      </button>
    </div>
    <div
      class="flex justify-center mt-8 mb-6 text-white text-xl md:text-3xl font-bold"
    >
      Gerenciar transações
    </div>
    <div class="w-full max-w-xs md:max-w-lg">
      <ListingComponent
        :valid-deposits="depositList"
        :wallet-transactions="lastWalletTransactions"
        :active-lock-amount="activeLockAmount"
        @deposit-withdrawn="callWithdraw"
      ></ListingComponent>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.page {
  @apply flex flex-col items-center justify-center w-full mt-16;
}

p {
  @apply text-gray-900;
}

.text-container {
  @apply flex flex-col items-center justify-center gap-4;
}

.text {
  @apply text-white text-center;
}

.last-release-info {
  @apply font-medium text-base text-gray-900;
}

input[type='number']::-webkit-inner-spin-button,
input[type='number']::-webkit-outer-spin-button {
  -webkit-appearance: none;
}
</style>

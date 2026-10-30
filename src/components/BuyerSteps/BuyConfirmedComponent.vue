<script setup lang="ts">
import {
  getCurrentAccount,
  getPublicClient,
  getWalletClient,
} from '@/blockchain/provider';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import CustomButton from '@/components/ui/CustomButton.vue';
import { useUser } from '@/composables/useUser';
import { computed, onMounted, ref } from 'vue';
import ListingComponent from '@/components/ListingComponent/ListingComponent.vue';
import ReputationNewLimitLine from '@/components/BuyerSteps/Reputation/ReputationNewLimitLine.vue';
import type { LimitChange } from '@/utils/reputation';
import SwapOrderStatus from '@/components/Swap/SwapOrderStatus.vue';
import { cancelSwap, requoteSwap } from '@/blockchain/swap';
import { findSwapToken } from '@/model/BuyToken';
import { TokenEnum } from '@/model/NetworkEnum';
import { erc20Abi, UserRejectedRequestError, type Hex } from 'viem';
import {
  useSellerLockStateQuery,
  useWalletDepositsQuery,
  useWalletAddress,
  useWalletTransactionsQuery,
} from '@/queries/wallet';
import { useWithdrawDepositMutation } from '@/queries/mutations';

// props
const props = defineProps<{
  tokenAmount: number | undefined;
  newLimit: LimitChange | null;
  /** Present when the buyer asked for another token after the release. */
  swap?: { uid: Hex | null; token: string };
  /** Rendered inside the offer column: the layout already shows the hero. */
  embedded?: boolean;
}>();

const user = useUser();
const { network, selectedToken } = user;
const walletAddress = useWalletAddress();

const alertType = ref<'withdraw' | 'withdrawError' | null>(null);
const isWatchingToken = ref(false);
const watchTokenAlert = ref<{
  type: 'success' | 'error';
  message: string;
} | null>(null);

const depositsQuery = useWalletDepositsQuery(
  network,
  selectedToken,
  walletAddress,
);
const transactionsQuery = useWalletTransactionsQuery(network, walletAddress);
const lockStateQuery = useSellerLockStateQuery(network, walletAddress);
const withdrawMutation = useWithdrawDepositMutation();

const depositList = computed(() => depositsQuery.data.value ?? []);
const lastWalletTransactions = computed(
  () => transactionsQuery.data.value ?? [],
);
const activeLockAmount = computed(
  () => lockStateQuery.data.value?.activeLockAmount ?? 0,
);
const loadingWalletTransactions = computed(
  () =>
    depositsQuery.isPending.value ||
    transactionsQuery.isPending.value ||
    lockStateQuery.isPending.value,
);

const callWithdraw = async (amount: string) => {
  if (!amount || !walletAddress.value) return;

  try {
    const withdrawn = await withdrawMutation.mutateAsync({
      amount,
      seller: walletAddress.value,
      network: network.value,
      token: network.value.tokens[selectedToken.value].address,
    });
    alertType.value = withdrawn ? 'withdraw' : 'withdrawError';
  } catch (error) {
    alertType.value = 'withdrawError';
    console.error('Não foi possível realizar o saque!', error);
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
const requoteBought = () => requoteSwap(props.swap?.token ?? '');
const keepBrz = (uid: Hex) => cancelSwap(uid, brzAddress.value);

// The buy flow re-enters this step after a purchase, so refresh what the
// wallet shows instead of waiting for staleTime to expire. The component is
// mounted fresh each time the flow reaches this step, so mounting is the
// event to hook — a watcher on a prop that is already true at mount never
// runs. `cancelRefetch: false` lets the initial fetch vue-query already
// started during setup finish: a cold mount issues exactly one request per
// query instead of refetch() cancelling and re-issuing it.
onMounted(() => {
  void Promise.all([
    depositsQuery.refetch({ cancelRefetch: false }),
    transactionsQuery.refetch({ cancelRefetch: false }),
    lockStateQuery.refetch({ cancelRefetch: false }),
  ]);
});
</script>

<template>
  <CustomAlert
    v-if="alertType"
    :key="alertType"
    :type="alertType"
    @close-alert="alertType = null"
  />
  <div :class="props.embedded ? 'flex flex-col items-center w-full' : 'page'">
    <div v-if="!props.embedded" class="text-container">
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
        :loading="loadingWalletTransactions"
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

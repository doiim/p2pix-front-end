import { ref } from 'vue';
import type { ValidDeposit } from '@/model/ValidDeposit';
import type { Address } from 'viem';
import { DEFAULT_NETWORK, Networks } from '@/config/networks';
import { TokenEnum, NetworkConfig } from '@/model/NetworkEnum';

export type Toast = { type: 'success' | 'error'; message: string };

/** How long a toast stays on screen — shared by every toast in the app. */
const TOAST_MS = 3_000;

const walletAddress = ref<Address | null>(null);
const balance = ref('');
const network = ref(DEFAULT_NETWORK);
const selectedToken = ref<TokenEnum>(TokenEnum.BRZ);
const loadingLock = ref(false);
const sellerView = ref(false);
const depositsValidList = ref<ValidDeposit[]>([]);
const loadingWalletTransactions = ref(false);
const loadingNetworkLiquidity = ref(false);
// R$ per whole unit, by symbol. BRZ is worth R$ 1 until the backend says
// otherwise.
const prices = ref<Partial<Record<string, number>>>({ [TokenEnum.BRZ]: 1 });
const toast = ref<Toast | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function useUser() {
  // Actions become regular functions
  const setWalletAddress = (address: Address | null) => {
    walletAddress.value = address;
  };

  const setBalance = (newBalance: string) => {
    balance.value = newBalance;
  };

  const setSelectedToken = (token: TokenEnum) => {
    selectedToken.value = token;
  };

  const setNetwork = (chain: NetworkConfig) => {
    network.value = chain;
  };

  const setNetworkById = (id: number) => {
    const chain = Networks.find((n) => n.id === id);
    if (chain) {
      network.value = chain;
    }
  };

  const setLoadingLock = (isLoading: boolean) => {
    loadingLock.value = isLoading;
  };

  const setSellerView = (view: boolean) => {
    sellerView.value = view;
  };

  const setDepositsValidList = (deposits: ValidDeposit[]) => {
    depositsValidList.value = deposits;
  };

  const setLoadingWalletTransactions = (isLoading: boolean) => {
    loadingWalletTransactions.value = isLoading;
  };

  const setLoadingNetworkLiquidity = (isLoading: boolean) => {
    loadingNetworkLiquidity.value = isLoading;
  };

  const setPrices = (fetched: Record<string, number>) => {
    prices.value = { ...prices.value, ...fetched };
  };

  const showToast = (type: Toast['type'], message: string): void => {
    toast.value = { type, message };
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toast.value = null), TOAST_MS);
  };

  return {
    // State
    walletAddress,
    balance,
    network,
    selectedToken,
    loadingLock,
    sellerView,
    depositsValidList,
    loadingWalletTransactions,
    loadingNetworkLiquidity,
    prices,
    toast,

    // Actions
    setWalletAddress,
    setBalance,
    setSelectedToken,
    setNetwork,
    setNetworkById,
    setLoadingLock,
    setSellerView,
    setDepositsValidList,
    setLoadingWalletTransactions,
    setLoadingNetworkLiquidity,
    setPrices,
    showToast,
  };
}

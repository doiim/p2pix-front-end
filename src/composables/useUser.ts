import { ref } from 'vue';
import type { ValidDeposit } from '@/model/ValidDeposit';
import type { Participant } from '../utils/bbPay';
import type { Address } from 'viem';
import { DEFAULT_NETWORK, Networks } from '@/config/networks';
import { TokenEnum, NetworkConfig } from '@/model/NetworkEnum';

const walletAddress = ref<Address | null>(null);
const balance = ref('');
const network = ref(DEFAULT_NETWORK);
const selectedToken = ref<TokenEnum>(TokenEnum.BRZ);
const loadingLock = ref(false);
const sellerView = ref(false);
const depositsValidList = ref<ValidDeposit[]>([]);
const loadingWalletTransactions = ref(false);
const loadingNetworkLiquidity = ref(false);
const seller = ref<Participant>({} as Participant);
const sellerId = ref('');

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

  const setSeller = (newSeller: Participant) => {
    seller.value = newSeller;
  };

  const setSellerId = (id: string) => {
    sellerId.value = id;
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
    seller,
    sellerId,

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
    setSeller,
    setSellerId,
  };
}

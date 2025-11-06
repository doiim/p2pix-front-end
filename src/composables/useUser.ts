import { ref } from "vue";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { Participant } from "../utils/bbPay";
import type { Address } from "viem"
import { DEFAULT_NETWORK, Networks } from "@/config/networks";
import { TokenEnum, NetworkConfig } from "@/model/NetworkEnum"

const walletAddress = ref<Address | null>(null);
const balance = ref("");
const network = ref(DEFAULT_NETWORK);
const selectedToken = ref<TokenEnum>(TokenEnum.BRZ);
const loadingLock = ref(false);
const sellerView = ref(false);
const depositsValidList = ref<ValidDeposit[]>([]);
const loadingWalletTransactions = ref(false);
const loadingNetworkLiquidity = ref(false);
const seller = ref<Participant>({} as Participant);
const sellerId = ref("");

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

  const setNetworkById = (id: string | number) => {
    let chainId: number;

    if (typeof id === 'string') {
      // Parse hex string or number string to number
      if (id.startsWith('0x')) {
        chainId = parseInt(id, 16);
      } else {
        chainId = parseInt(id, 10);
      }
    } else {
      chainId = id;
    }

    // Find network by chain ID
    const chain = Object.values(Networks).find(n => n.id === chainId);
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

  // Getters become computed or regular functions
  const getValidDepositByWalletAddress = (address: string) => {
    return depositsValidList.value
      .filter((deposit) => deposit.seller == address)
      .sort((a, b) => b.blockNumber - a.blockNumber);
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

    // Getters
    getValidDepositByWalletAddress,
  };
}

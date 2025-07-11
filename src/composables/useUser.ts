import { ref } from "vue";
import { NetworkEnum, TokenEnum } from "../model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import type { Participant } from "../utils/bbPay";
import { NetworkById } from "@/model/Networks";
import type { Address } from "viem"

const walletAddress = ref<Address | null>(null);
const balance = ref("");
const networkId = ref(11155111);
const networkName = ref(NetworkEnum.sepolia);
const selectedToken = ref(TokenEnum.BRZ);
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

  const setNetworkId = (network: string | number) => {
    networkName.value = NetworkById(network) || NetworkEnum.sepolia;
    networkId.value = Number(network);
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
    networkId,
    networkName,
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
    setNetworkId,
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

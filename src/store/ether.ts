import { NetworkEnum, TokenEnum } from "../model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { defineStore } from "pinia";

export const useEtherStore = defineStore("ether", {
  state: () => ({
    walletAddress: "",
    balance: "",
    networkName: NetworkEnum.sepolia,
    selectedToken: TokenEnum.BRZ,
    loadingLock: false,
    sellerView: false,
    depositsValidList: [] as ValidDeposit[],
    loadingWalletTransactions: false,
    loadingNetworkLiquidity: false,
  }),
  actions: {
    setWalletAddress(walletAddress: string) {
      this.walletAddress = walletAddress;
    },
    setBalance(balance: string) {
      this.balance = balance;
    },
    setSelectedToken(token: TokenEnum) {
      this.selectedToken = token;
    },
    setNetworkId(networkName: NetworkEnum) {
      this.networkName = Number(networkName);
    },
    setLoadingLock(isLoadingLock: boolean) {
      this.loadingLock = isLoadingLock;
    },
    setSellerView(sellerView: boolean) {
      this.sellerView = sellerView;
    },
    setDepositsValidList(depositsValidList: ValidDeposit[]) {
      this.depositsValidList = depositsValidList;
    },
    setLoadingWalletTransactions(isLoadingWalletTransactions: boolean) {
      this.loadingWalletTransactions = isLoadingWalletTransactions;
    },
    setLoadingNetworkLiquidity(isLoadingNetworkLiquidity: boolean) {
      this.loadingNetworkLiquidity = isLoadingNetworkLiquidity;
    },
  },
  getters: {
    getValidDepositByWalletAddress: (state) => {
      return (walletAddress: string) =>
        state.depositsValidList
          .filter((deposit) => deposit.seller == walletAddress)
          .sort((a, b) => {
            return b.blockNumber - a.blockNumber;
          });
    },
  },
});

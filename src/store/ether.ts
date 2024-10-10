
import { NetworkEnum, TokenEnum } from "../model/NetworkEnum";
import type { ValidDeposit } from "@/model/ValidDeposit";
import { defineStore } from "pinia";



export const useEtherStore = defineStore("ether", {
  state: () => ({
    walletAddress: "",
    balance: "",
    networkName: NetworkEnum.ethereum,
    selectedToken: TokenEnum.BRZ,
    loadingLock: false,
    sellerView: false,
    // Depósitos válidos para compra SEPOLIA
    depositsValidListSepolia: [] as ValidDeposit[],
    // Depósitos válidos para compra MUMBAI
    depositsValidListMumbai: [] as ValidDeposit[],
    // Depósitos válidos para compra ROOTSTOCK
    depositsValidListRootstock: [] as ValidDeposit[],
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
    setNetworkName(networkName: NetworkEnum) {
      this.networkName = Number(networkName);
    },
    setLoadingLock(isLoadingLock: boolean) {
      this.loadingLock = isLoadingLock;
    },
    setSellerView(sellerView: boolean) {
      this.sellerView = sellerView;
    },
    setDepositsValidListSepolia(depositsValidList: ValidDeposit[]) {
      this.depositsValidListSepolia = depositsValidList;
    },
    setDepositsValidListMumbai(depositsValidList: ValidDeposit[]) {
      this.depositsValidListMumbai = depositsValidList;
    },
    setDepositsValidListRootstock(depositsValidList: ValidDeposit[]) {
      this.depositsValidListRootstock = depositsValidList;
    },
    setLoadingWalletTransactions(isLoadingWalletTransactions: boolean) {
      this.loadingWalletTransactions = isLoadingWalletTransactions;
    },
    setLoadingNetworkLiquidity(isLoadingNetworkLiquidity: boolean) {
      this.loadingNetworkLiquidity = isLoadingNetworkLiquidity;
    },
  },
  // Alterar para integrar com mumbai
  getters: {
    getValidDepositByWalletAddress: (state) => {
      return (walletAddress: string) =>
        state.depositsValidListSepolia
          .filter((deposit) => deposit.seller == walletAddress)
          .sort((a, b) => {
            return b.blockNumber - a.blockNumber;
          });
    },
  },
});

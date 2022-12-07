import { defineStore } from "pinia";

export const useEtherStore = defineStore("ether", {
  state: () => ({
    walletAddress: "",
    balance: "",
    
    // Depósitos válidos para compra
    depositsValidList: [] as any[],
    // Depósitos adicionados na blockchain
    depositsAddedList: [] as any[],
    // Depósitos expirados na blockchain
    depositsExpiredList: [] as any[],
    // Locks adicionados na blockchain
    locksAddedList: [] as any[],
    // Locks 'released' na blockchain
    locksReleasedList: [] as any[],
    // Locks expirados na blockchain
    locksExpiredList: [] as any[]
  }),
  actions: {
    setWalletAddress(walletAddress: string) {
      this.walletAddress = walletAddress;
    },
    setBalance(balance: string) {
      this.balance = balance;
    },
    setDepositsValidList(depositsValidList: any[]) {
      this.depositsValidList = depositsValidList;
    },
    setDepositsAddedList(depositsAddedList: any[]) {
      this.depositsAddedList = depositsAddedList;
    },
    setDepositsExpiredList(depositsExpiredList: any[]) {
      this.depositsExpiredList = depositsExpiredList;
    },
    setLocksAddedList(locksAddedList: any[]) {
      this.locksAddedList = locksAddedList;
    },
    setLocksReleasedList(locksReleasedList: any[]) {
      this.locksReleasedList = locksReleasedList;
    },
    setLocksExpiredList(locksExpiredList: any[]) {
      this.locksExpiredList = locksExpiredList;
    },
  },
});
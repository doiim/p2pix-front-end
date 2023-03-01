import type { WalletTransaction } from "../WalletTransaction";

export const MockWalletTransactions: WalletTransaction[] = [
  {
    blockNumber: 1,
    token: "1",
    amount: 70,
    seller: "mockedSellerAddress",
    buyer: "mockedBuyerAddress",
    event: "Deposit",
    lockStatus: 0,
    transactionHash: "1",
  },
  {
    blockNumber: 2,
    token: "2",
    amount: 200,
    seller: "mockedSellerAddress",
    buyer: "mockedBuyerAddress",
    event: "Lock",
    lockStatus: 1,
    transactionHash: "2",
  },
  {
    blockNumber: 3,
    token: "3",
    amount: 1250,
    seller: "mockedSellerAddress",
    buyer: "mockedBuyerAddress",
    event: "Release",
    lockStatus: 2,
    transactionHash: "3",
  },
  {
    blockNumber: 4,
    token: "4",
    amount: 4000,
    seller: "mockedSellerAddress",
    buyer: "mockedBuyerAddress",
    event: "Deposit",
    lockStatus: 0,
    transactionHash: "4",
  },
  {
    blockNumber: 5,
    token: "5",
    amount: 2000,
    seller: "mockedSellerAddress",
    buyer: "mockedBuyerAddress",
    event: "Deposit",
    lockStatus: 3,
    transactionHash: "5",
  },
];

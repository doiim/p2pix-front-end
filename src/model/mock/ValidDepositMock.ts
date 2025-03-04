import type { ValidDeposit } from "../ValidDeposit";
import { NetworkEnum } from "@/model/NetworkEnum";

export const MockValidDeposits: ValidDeposit[] = [
  {
    blockNumber: 1,
    token: "1",
    remaining: 70,
    seller: "mockedSellerAddress",
    pixKey: "123456789",
    network: NetworkEnum.sepolia,
  },
  {
    blockNumber: 2,
    token: "2",
    remaining: 200,
    seller: "mockedSellerAddress",
    pixKey: "123456789",
    network: NetworkEnum.sepolia,
  },
  {
    blockNumber: 3,
    token: "3",
    remaining: 1250,
    seller: "mockedSellerAddress",
    pixKey: "123456789",
    network: NetworkEnum.sepolia,
  },
  {
    blockNumber: 4,
    token: "4",
    remaining: 4000,
    seller: "mockedSellerAddress",
    pixKey: "123456789",
    network: NetworkEnum.sepolia,
  },
  {
    blockNumber: 5,
    token: "5",
    remaining: 2000,
    seller: "mockedSellerAddress",
    pixKey: "123456789",
    network: NetworkEnum.sepolia,
  },
];

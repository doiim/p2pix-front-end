import { NetworkEnum } from "./NetworkEnum";
import type { Address } from "viem";

export type ValidDeposit = {
  token: Address;
  blockNumber: number;
  remaining: number;
  seller: Address;
  participantID: string;
  network: NetworkEnum;
  open?: boolean;
};

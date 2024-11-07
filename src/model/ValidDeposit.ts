import { NetworkEnum } from "./NetworkEnum";

export type ValidDeposit = {
  token: string;
  blockNumber: number;
  remaining: number;
  seller: string;
  pixKey: string;
  network: NetworkEnum;
  open?: boolean;
};

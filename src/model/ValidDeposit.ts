export type ValidDeposit = {
  token: string;
  blockNumber: number;
  remaining: number;
  seller: string;
  pixKey: string;
  open?: boolean;
};

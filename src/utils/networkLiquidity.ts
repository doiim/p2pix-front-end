import type { ValidDeposit } from "@/model/ValidDeposit";

const verifyNetworkLiquidity = (
  tokenValue: number,
  walletAddress: string,
  validDepositList: ValidDeposit[]
): ValidDeposit[] => {
  const filteredDepositList = validDepositList
    .filter((element) => {
      const remaining = element.remaining;
      if (
        tokenValue!! <= remaining &&
        tokenValue!! != 0 &&
        element.seller !== walletAddress
      ) {
        return true;
      }
      return false;
    })
    .sort((a, b) => {
      return b.remaining - a.remaining;
    });

  const uniqueNetworkDeposits = filteredDepositList.reduce(
    (acc: ValidDeposit[], current) => {
      const existingNetwork = acc.find(
        (deposit) => deposit.network === current.network
      );
      if (!existingNetwork) {
        acc.push(current);
      }
      return acc;
    },
    []
  );
  return uniqueNetworkDeposits;
};

export { verifyNetworkLiquidity };

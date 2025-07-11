export enum NetworkEnum {
  sepolia = 11155111,
  rootstock = 31,
}

export const getNetworkSubgraphURL = (network: NetworkEnum) => {
  const networkMap: Record<NetworkEnum, string> = {
    [NetworkEnum.sepolia]: import.meta.env.VITE_SEPOLIA_SUBGRAPH_URL || "",
    [NetworkEnum.rootstock]: import.meta.env.VITE_RSK_SUBGRAPH_URL || "",
  };

  return networkMap[network] || "";
};

export enum TokenEnum {
  BRZ = "BRZ",
  // BRX = 'BRX'
}

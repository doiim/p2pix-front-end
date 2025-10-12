import type { TokenEnum } from "@/model/NetworkEnum";
import { Networks } from "@/config/networks";

export const getNetworkImage = (networkName: string): string => {
  const normalizedName = networkName.toLowerCase().replace(/[^a-z0-9]/g, '-');
  return new URL(`../assets/networks/${normalizedName}.svg`, import.meta.url).href;
};

export const getTokenImage = (tokenName: TokenEnum): string => {
  return new URL(`../assets/tokens/${tokenName.toLowerCase()}.svg`, import.meta.url).href;
};

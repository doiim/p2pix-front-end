import { TokenEnum, type NetworkConfig } from '@/model/NetworkEnum';

export type BuyToken = { symbol: string; name: string };

const BRZ: BuyToken = {
  symbol: TokenEnum.BRZ,
  name: 'Brazilian Digital Token',
};

/** A token delivered through the post-release swap on this chain, if any. */
export const findSwapToken = (network: NetworkConfig, symbol: string) =>
  network.swap?.tokens.find((t) => t.symbol === symbol);

/**
 * Preselected in the selectors: the chain's first swap token (USDT on
 * Arbitrum), or BRZ where there is no swap. The contract still only moves BRZ.
 */
export const defaultUiToken = (network: NetworkConfig): string =>
  network.swap?.tokens[0]?.symbol ?? TokenEnum.BRZ;

/** The chain's swap tokens in config order, then BRZ. */
export const searchBuyTokens = (
  query: string,
  network: NetworkConfig,
): BuyToken[] => {
  const needle = query.trim().toLowerCase();
  return [...(network.swap?.tokens ?? []), BRZ].filter(
    (token) =>
      token.symbol.toLowerCase().includes(needle) ||
      token.name.toLowerCase().includes(needle),
  );
};

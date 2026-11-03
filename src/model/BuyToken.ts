import { TokenEnum, type NetworkConfig } from '@/model/NetworkEnum';

export type BuyToken = { symbol: string; name: string };

const BRZ: BuyToken = {
  symbol: TokenEnum.BRZ,
  name: 'Brazilian Digital Token',
};

/**
 * A token delivered through the post-release swap on this chain, if any. The
 * contract's own configured tokens deposit as is — never swap for them, even
 * were one listed among the swap tokens.
 */
export const findSwapToken = (network: NetworkConfig, symbol: string) =>
  symbol in network.tokens
    ? undefined
    : network.swap?.tokens.find((t) => t.symbol === symbol);

/**
 * Preselected in the sell card: the contract's configured token, which the
 * deposit moves as is. Paying with a swap token is picked explicitly and first
 * buys the offer's tokens on CoW.
 */
export const defaultUiToken = (network: NetworkConfig): string =>
  Object.keys(network.tokens)[0] ?? TokenEnum.BRZ;

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

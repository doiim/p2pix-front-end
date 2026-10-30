import { getTokenBalances } from '@doiim/passkeys/smart-account';
import type { Address } from 'viem';
import { Networks } from '@/config/networks';
import type { NetworkConfig } from '@/model/NetworkEnum';
import { getPublicClient } from './provider';

export type DiscoveredToken = {
  symbol: string;
  /** Absent for the chain's native coin. */
  address?: Address;
  balance: bigint;
  decimals: number;
};

export type NetworkHoldings = {
  network: NetworkConfig;
  tokens: DiscoveredToken[];
};

export type DiscoveredBalances = {
  holdings: NetworkHoldings[];
  failed: NetworkConfig[];
};

// Every ERC-20 the app knows on a network: BRZ first, then the swap tokens in
// config order.
export const watchedTokens = (
  network: NetworkConfig,
): { symbol: string; address: Address }[] => {
  const base = Object.entries(network.tokens).map(([symbol, { address }]) => ({
    symbol,
    address,
  }));
  const swap = (network.swap?.tokens ?? []).filter(
    (token) => !(token.symbol in network.tokens),
  );
  return [...base, ...swap.map(({ symbol, address }) => ({ symbol, address }))];
};

const readNetwork = async (
  network: NetworkConfig,
  owner: Address,
): Promise<NetworkHoldings> => {
  const watched = watchedTokens(network);
  const { eth, tokens } = await getTokenBalances(
    getPublicClient(network.id),
    owner,
    watched.map((token) => token.address),
  );
  const erc20s = tokens.map((read, index) => ({
    ...read,
    symbol: watched[index]!.symbol,
  }));
  const native = {
    symbol: network.nativeCurrency.symbol,
    balance: eth,
    decimals: network.nativeCurrency.decimals,
  };
  return {
    network,
    tokens: [...erc20s, native].filter((token) => token.balance > 0n),
  };
};

/**
 * Non-zero balances of `owner` on every configured network, each read with
 * that network's own client. A network whose read fails is listed in
 * `failed`, never reported as empty.
 */
export const discoverBalances = async (
  owner: Address,
): Promise<DiscoveredBalances> => {
  const results = await Promise.allSettled(
    Networks.map((network) => readNetwork(network, owner)),
  );

  const failed = Networks.filter((network, index) => {
    const result = results[index];
    if (result.status === 'fulfilled') return false;
    console.error(`[balances] could not read ${network.name}`, result.reason);
    return true;
  });

  const holdings = results.flatMap((result) =>
    result.status === 'fulfilled' && result.value.tokens.length > 0
      ? [result.value]
      : [],
  );

  return { holdings, failed };
};

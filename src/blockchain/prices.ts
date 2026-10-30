// R$ price of the assets in the account panel. BRZ is the real, so every price
// is "how much BRZ does one whole token buy". The CoW order book is the only
// price source; any failure is a missing price, never an error in the UI.

import { zeroAddress, type Address } from 'viem';
import { quote } from '@/utils/cowApi';
import { TokenEnum, type NetworkConfig } from '@/model/NetworkEnum';
import { tokenDecimals } from './swap';

const TTL_MS = 60_000;
const NATIVE_WRAPPER = 'WETH';

const cache = new Map<string, { at: number; price: Promise<bigint | null> }>();

const quoteOne = async (
  network: NetworkConfig,
  sellToken: Address,
  from: Address,
): Promise<bigint | null> => {
  if (!network.swap) return null;
  const buyToken = network.tokens[TokenEnum.BRZ].address;
  const unit = 10n ** BigInt(await tokenDecimals(network, sellToken));
  const q = await quote(network.swap, {
    sellToken,
    buyToken,
    from,
    kind: 'sell',
    amount: unit,
    priceQuality: 'fast',
  });
  // The quote's sell side is net of the fee; scale back to the fee-free price.
  return q.sellAmount === 0n
    ? null
    : (q.buyAmount * (q.sellAmount + q.feeAmount)) / q.sellAmount;
};

const fetchPrice = async (
  network: NetworkConfig,
  token: string | undefined,
  from: Address,
): Promise<bigint | null> => {
  if (token === TokenEnum.BRZ) {
    const brz = network.tokens[TokenEnum.BRZ].address;
    return 10n ** BigInt(await tokenDecimals(network, brz));
  }
  const symbol = token ?? NATIVE_WRAPPER;
  const found = network.swap?.tokens.find((t) => t.symbol === symbol);
  return found ? quoteOne(network, found.address, from) : null;
};

/**
 * BRZ base units for one whole `token` (undefined = the native coin), or null
 * when no price is known. Cached per chain and token for 60 s. `from` only
 * names the quote's owner.
 */
export const priceInBrz = (
  network: NetworkConfig,
  token?: string,
  from: Address = zeroAddress,
): Promise<bigint | null> => {
  const key = `${network.id}:${token ?? 'native'}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.price;
  const price = fetchPrice(network, token, from).catch((cause: unknown) => {
    console.error(`[prices] no price for ${key}`, cause);
    cache.delete(key);
    return null;
  });
  cache.set(key, { at: Date.now(), price });
  return price;
};

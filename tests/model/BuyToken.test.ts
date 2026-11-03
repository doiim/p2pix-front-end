import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import { findSwapToken, defaultUiToken } from '@/model/BuyToken';
import type { NetworkConfig } from '@/model/NetworkEnum';

const BRZ: Address = '0x3333333333333333333333333333333333333333';
const USDT: Address = '0x4444444444444444444444444444444444444444';

/** `swap.tokens` lists what may buy the offer's tokens, even a misconfigured
 * overlap with the contract's own token. */
const network = {
  tokens: { BRZ: { address: BRZ } },
  swap: {
    apiUrl: 'https://api.cow.fi/test',
    settlement: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41' as Address,
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', address: USDT },
      { symbol: 'BRZ', name: 'Brazilian Digital Token', address: BRZ },
    ],
  },
} as typeof network & NetworkConfig;

describe('a configured contract token never swaps', () => {
  it('is not a swap token even when listed among the swap tokens', () => {
    expect(findSwapToken(network, 'BRZ')).toBeUndefined();
  });

  it('keeps swap-only tokens swap tokens', () => {
    expect(findSwapToken(network, 'USDT')?.address).toBe(USDT);
  });

  it('preselects the configured token in the sell card', () => {
    expect(defaultUiToken(network)).toBe('BRZ');
  });
});

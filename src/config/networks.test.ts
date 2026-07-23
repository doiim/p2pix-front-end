import { describe, expect, it } from 'vitest';

import { env, type Env } from '@/config/env';
import { buildNetworks } from '@/config/networks';

const ADDRESS_A = `0x${'1'.repeat(40)}` as const;
const ADDRESS_B = `0x${'2'.repeat(40)}` as const;

const makeEnv = (overrides: Partial<Env> = {}): Env =>
  ({
    ...env,
    local: { p2pix: undefined, token: undefined },
    arbitrum: {
      rpc: undefined,
      p2pix: undefined,
      token: undefined,
      subgraph: undefined,
    },
    ethereum: {
      rpc: undefined,
      p2pix: undefined,
      token: undefined,
      subgraph: undefined,
    },
    passkey: {
      ...env.passkey,
      bundlerUrl: undefined,
      bundlerUrls: { 1: undefined, 42161: undefined },
      paymasterPolicies: {
        1: {},
        42161: {},
      },
    },
    ...overrides,
  }) as Env;

describe('buildNetworks', () => {
  it('registers Ethereum and Arbitrum with AppKit without exposing undeployed trading rails', () => {
    const result = buildNetworks(makeEnv());

    expect(result.wagmiNetworks.map((network) => Number(network.id))).toContain(
      1,
    );
    expect(result.wagmiNetworks.map((network) => Number(network.id))).toContain(
      42161,
    );
    expect(result.networks.ethereum).toBeUndefined();
    expect(result.networks.arbitrum).toBeUndefined();
  });

  it('adds simultaneous first-lock and paid-operation policies per trading chain', () => {
    const configured = makeEnv({
      arbitrum: {
        rpc: 'https://arb.example',
        p2pix: ADDRESS_A,
        token: ADDRESS_B,
        subgraph: undefined,
      },
      ethereum: {
        rpc: 'https://eth.example',
        p2pix: ADDRESS_A,
        token: ADDRESS_B,
        subgraph: undefined,
      },
      passkey: {
        ...env.passkey,
        bundlerUrl: 'https://legacy.example',
        bundlerUrls: {
          1: 'https://mainnet-bundler.example',
          42161: undefined,
        },
        paymasterPolicies: {
          1: {
            firstLock: { sponsorshipPolicyId: 'mainnet-first-lock' },
            paidOperations: { token: ADDRESS_B },
          },
          42161: {
            firstLock: { sponsorshipPolicyId: 'arb-first-lock' },
            paidOperations: { token: ADDRESS_B },
          },
        },
      },
    });
    const { networks } = buildNetworks(configured);

    expect(networks.ethereum?.aa).toEqual({
      bundlerUrl: 'https://mainnet-bundler.example',
      paymasterPolicies: {
        firstLock: { sponsorshipPolicyId: 'mainnet-first-lock' },
        paidOperations: { token: ADDRESS_B },
      },
      paymasterPolicy: { type: 'erc20', token: ADDRESS_B },
    });
    expect(networks.arbitrum?.aa).toEqual({
      bundlerUrl: 'https://legacy.example',
      paymasterPolicies: {
        firstLock: { sponsorshipPolicyId: 'arb-first-lock' },
        paidOperations: { token: ADDRESS_B },
      },
      paymasterPolicy: { type: 'erc20', token: ADDRESS_B },
    });
    expect(
      Object.values(networks).find((network) => network.id === 11155111)?.aa,
    ).toBeUndefined();
  });

  it('preserves local anvil as the default exactly-mode-compatible AA rail', () => {
    const configured = makeEnv({
      local: { p2pix: ADDRESS_A, token: ADDRESS_B },
    });
    const { defaultNetwork, networks } = buildNetworks(configured);

    expect(defaultNetwork.id).toBe(31337);
    expect(networks.localhost.aa?.paymasterPolicies).toEqual({});
    expect(networks.localhost.aa?.paymasterPolicy).toBeUndefined();
  });
});

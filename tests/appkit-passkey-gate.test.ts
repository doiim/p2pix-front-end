import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Connector } from '@wagmi/core';

import type * as AppkitConfig from '@/config/appkit';
import { PASSKEY_CONNECTOR_ID } from '@/config/aa';
import { Networks } from '@/config/networks';

// `aa` marks the chains that can run a Kernel account (see config/networks.ts).
const aaChain = Networks.find((n) => Boolean(n.aa))!;
const nonAaChain = Networks.find((n) => !n.aa)!;

// happy-dom leaves window.localStorage undefined, and the passkey connector
// reads it while it is being built.
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
});

let appkit: typeof AppkitConfig;

beforeEach(async () => {
  // CI runs this suite without the app's .env; config/appkit.ts throws on a
  // missing project id, so the value has to exist before the module loads.
  vi.stubEnv('VITE_REOWN_PROJECT_ID', 'test-project-id');
  vi.stubEnv('VITE_PIMLICO_SPONSORSHIP_POLICY_ID', 'test-policy');
  // setupAppKit() memoises its adapter, so each case needs a fresh module.
  vi.resetModules();
  appkit = await import('@/config/appkit');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const passkeyConnector = (): Connector | undefined =>
  appkit.getWagmiConfig().connectors.find((c) => c.id === PASSKEY_CONNECTOR_ID);

// `connect` is readonly on wagmi's Connector; this view only erases its
// capability overloads so the test can call it.
const callConnect = (connector: Connector) =>
  (
    connector as unknown as { connect: (args?: unknown) => Promise<unknown> }
  ).connect();

describe('passkey connector gate', () => {
  it('refuses connect() on a chain without an AA rail, before any ceremony', async () => {
    appkit.setupAppKit();
    appkit.syncPasskeyAvailability(nonAaChain);

    await expect(callConnect(passkeyConnector()!)).rejects.toThrow(
      /no AA rail; refusing to connect/,
    );
  });

  it('lets connect() through on a chain with an AA rail', async () => {
    appkit.setupAppKit();
    appkit.syncPasskeyAvailability(aaChain);

    // Reaches the connector's own flow, which needs a real browser — any error
    // other than the gate's means the call was forwarded.
    const error: unknown = await callConnect(passkeyConnector()!).catch(
      (e: unknown) => e,
    );
    expect((error as Error).message).not.toMatch(/no AA rail/);
  });

  it('fails shut when the connector it must guard is missing', () => {
    expect(() => appkit.guardPasskeyConnector([])).toThrow(
      /would be unguarded/,
    );
  });

  it('registers no passkey rail, and needs no gate, without a sponsorship policy', async () => {
    vi.stubEnv('VITE_PIMLICO_SPONSORSHIP_POLICY_ID', '');
    vi.resetModules();
    appkit = await import('@/config/appkit');
    appkit.setupAppKit();

    expect(passkeyConnector()).toBeUndefined();
  });
});

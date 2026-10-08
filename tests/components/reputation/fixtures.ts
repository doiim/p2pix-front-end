import { createApp, h, reactive, shallowRef } from 'vue';
import type { Component } from 'vue';
import type { ReputationSnapshot } from '@/utils/reputation';

const account = '0x1111111111111111111111111111111111111111';

// Preset P3 from the canvas: Arbitrum One, credit 1000, limit 2256, BASE 256.
export const snapshotP3: ReputationSnapshot = {
  chainId: 42161,
  p2pix: '0x2222222222222222222222222222222222222222',
  account,
  blockNumber: 123456789n,
  key: BigInt(account) << 12n,
  reputation: '0x3333333333333333333333333333333333333333',
  creditTokens: 1000n,
  limiterValue: 2256n,
  limitTokens: 2256n,
  baseValue: 256n,
  newWalletLimitTokens: 256n,
  nextLimitTokens: 6767n,
  curve: { base: 256n, maxLimit: 1_000_000n, magicValue: 250_000_000_000n },
};

export const mount = (
  component: Component,
  initial: Record<string, unknown>,
) => {
  const props = reactive({ ...initial });
  const exposed = shallowRef<unknown>(null);
  const host = document.createElement('div');
  document.body.append(host);
  const app = createApp({
    render: () => h(component, { ...props, ref: exposed }),
  });
  app.mount(host);
  return {
    host,
    props,
    exposed,
    unmount: () => {
      app.unmount();
      host.remove();
    },
  };
};

export const text = (node: Element | null) =>
  (node?.textContent ?? '').replace(/\s+/g, ' ').trim();

export const byId = (host: Element, id: string) => host.querySelector(`#${id}`);

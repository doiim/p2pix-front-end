import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Address } from 'viem';
import { rootstockTestnet, sepolia } from 'viem/chains';
import type {
  BuyPress,
  ReputationSnapshot,
  ReputationTarget,
} from '@/utils/reputation';
import { byId, mount, text } from './fixtures';

// Only the network boundaries are stubbed: the limit read (the real store, fed by a reader the test
// controls) and the subgraph lookup of the seller's participant id. The wallet stack is the real one.
const chain = vi.hoisted(() => {
  const state = {
    limitTokens: 2256n,
    failing: false,
    hold: false,
    held: new Array<() => void>(),
    reads: 0,
  };
  const snapshot = (
    target: ReputationTarget,
    limitTokens: bigint,
  ): ReputationSnapshot => ({
    chainId: target.chainId,
    p2pix: target.p2pix,
    account: target.account,
    blockNumber: 1n,
    key: BigInt(target.account) << 12n,
    reputation: '0x3333333333333333333333333333333333333333',
    creditTokens: 1000n,
    limiterValue: limitTokens,
    limitTokens,
    baseValue: 256n,
    newWalletLimitTokens: 256n,
    nextLimitTokens: null,
    curve: null,
  });
  const read = (target: ReputationTarget): Promise<ReputationSnapshot> => {
    state.reads += 1;
    const settle = () =>
      state.failing
        ? Promise.reject(new Error('rpc down'))
        : Promise.resolve(snapshot(target, state.limitTokens));
    return state.hold
      ? new Promise((resolve, reject) =>
          state.held.push(() => void settle().then(resolve, reject)),
        )
      : settle();
  };
  return { state, read };
});

vi.mock('@/composables/useReputation', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/composables/useReputation')>();
  const { useUser } = await import('@/composables/useUser');
  const store = actual.createReputationStore(chain.read, () => {
    const user = useUser();
    const p2pix = user.network.value.contracts?.p2pix;
    const account = user.walletAddress.value;
    return account === null || p2pix === undefined || !('address' in p2pix)
      ? null
      : { chainId: user.network.value.id, p2pix: p2pix.address, account };
  });
  return { ...actual, useReputation: () => store };
});

vi.mock('@/blockchain/events', () => ({
  getParticipantID: async () => 'participant',
}));

// @/config/appkit throws at import time without a project id; nothing here opens the modal.
vi.stubEnv('VITE_REOWN_PROJECT_ID', 'unit-test');
const { useUser } = await import('@/composables/useUser');
const BuyerSearchComponent = (
  await import('@/components/BuyerSteps/BuyerSearchComponent.vue')
).default;

const user = useUser();
const CPF = '12345678901';
const P9 = 'Seu limite mudou desde a última leitura.';

// A fresh account per test, so the store's per-account cache never leaks between tests.
let accounts = 0;
const connect = (): Address => {
  accounts += 1;
  const account: Address = `0x${accounts.toString(16).padStart(40, 'a')}`;
  user.setNetworkById(sepolia.id);
  user.setWalletAddress(account);
  user.setDepositsValidList([
    {
      token: '0x4444444444444444444444444444444444444444',
      blockNumber: 1,
      remaining: 5000,
      seller: '0x5555555555555555555555555555555555555555',
      participantID: '',
      network: user.network.value,
    },
  ]);
  return account;
};

const settle = async () => {
  for (const _ of Array.from({ length: 5 })) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const views: (() => void)[] = [];
afterEach(() => {
  views.splice(0).forEach((unmount) => unmount());
  Object.assign(chain.state, {
    limitTokens: 2256n,
    failing: false,
    hold: false,
    held: [],
    reads: 0,
  });
});

const mountSearch = async (refusal: BuyPress | null = null) => {
  const presses: BuyPress[] = [];
  const view = mount(BuyerSearchComponent, {
    refusal,
    onTokenBuy: (_deposit: unknown, press: BuyPress) => presses.push(press),
  });
  views.push(view.unmount);
  await settle();
  return { host: view.host, presses };
};

const field = (host: Element, selector: string) => {
  const input = host.querySelector(selector);
  if (!(input instanceof HTMLInputElement)) throw new Error(`no ${selector}`);
  return input;
};
const amountInput = (host: Element) => field(host, 'input[name="tokenAmount"]');
const cpfInput = (host: Element) =>
  field(host, 'input[placeholder^="Digite seu CPF"]');

const type = async (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
  await settle();
};

// Dispatching submit skips the browser's required-field check, so fill the CPF as a user would.
const press = async (host: Element) => {
  if (cpfInput(host).value === '') await type(cpfInput(host), CPF);
  host
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { cancelable: true }));
  await settle();
};

const announced = (host: Element) => text(host.querySelector('[aria-live]'));
const focusedLabel = () => document.activeElement?.getAttribute('aria-label');

describe('BuyerSearchComponent with the reputation limit', () => {
  it('blocks an over-limit press only after a fresh read, and proceeds once the chain allows it', async () => {
    connect();
    const { host, presses } = await mountSearch();
    expect(chain.state.reads).toBe(1);

    await type(amountInput(host), '3000');
    expect(text(byId(host, 'rep-status'))).toBe('Acima do seu limite de');
    expect(amountInput(host).getAttribute('aria-invalid')).toBe('true');
    expect(chain.state.reads).toBe(1); // nothing per keystroke

    await press(host);
    expect(chain.state.reads).toBe(2);
    expect(presses).toEqual([]);
    expect(byId(host, 'rep-details')).not.toBeNull();
    expect(focusedLabel()).toBe('Máx: usar seu limite de R$ 2256');
    expect(announced(host)).toBe('Acima do seu limite de R$ 2256.');

    chain.state.limitTokens = 5000n;
    await press(host);
    expect(chain.state.reads).toBe(3);
    expect(presses).toEqual([
      { amount: 3000, identification: CPF, checkedWithin: true },
    ]);
  });

  it('proceeds at once within the cached limit, and unchecked when there is no reading', async () => {
    connect();
    const within = await mountSearch();
    await type(amountInput(within.host), '2000');
    await press(within.host);
    expect(chain.state.reads).toBe(1);
    expect(within.presses).toEqual([
      { amount: 2000, identification: CPF, checkedWithin: true },
    ]);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    chain.state.failing = true;
    connect();
    const unread = await mountSearch();
    await type(amountInput(unread.host), '3000');
    expect(byId(unread.host, 'rep-status')).toBeNull();
    await press(unread.host);
    expect(unread.presses).toEqual([
      { amount: 3000, identification: CPF, checkedWithin: false },
    ]);
  });

  it('reopens a refused press with its amount, its CPF, R3 and P9 when the last read said it fit', async () => {
    connect();
    chain.state.limitTokens = 1256n;
    const { host } = await mountSearch({
      amount: 3000,
      identification: CPF,
      checkedWithin: true,
    });
    expect(amountInput(host).value).toBe('3000');
    expect(cpfInput(host).value).toBe(CPF);
    expect(text(byId(host, 'rep-status'))).toBe(
      'O contrato recusou esta compra: seu limite atual é de',
    );
    expect(text(byId(host, 'rep-details'))).toContain(P9);
    expect(focusedLabel()).toBe('Máx: usar seu limite atual de R$ 1256');
    expect(announced(host)).toBe(
      'O contrato recusou esta compra: seu limite atual é de R$ 1256.',
    );
  });

  it('leaves P9 out when the refused press was not based on a reading', async () => {
    connect();
    chain.state.limitTokens = 1256n;
    const { host } = await mountSearch({
      amount: 3000,
      identification: CPF,
      checkedWithin: false,
    });
    expect(text(byId(host, 'rep-status'))).toBe(
      'O contrato recusou esta compra: seu limite atual é de',
    );
    expect(byId(host, 'rep-details')).not.toBeNull();
    expect(text(byId(host, 'rep-details'))).not.toContain(P9);
  });

  it('drops the refusal when the network changes', async () => {
    connect();
    chain.state.limitTokens = 1256n;
    const { host } = await mountSearch({
      amount: 3000,
      identification: CPF,
      checkedWithin: true,
    });
    expect(text(byId(host, 'rep-status'))).toBe(
      'O contrato recusou esta compra: seu limite atual é de',
    );

    chain.state.limitTokens = 256n;
    user.setNetworkById(rootstockTestnet.id);
    await settle();
    expect(text(byId(host, 'rep-status'))).toBe('Acima do seu limite de');
    expect(text(byId(host, 'rep-amount'))).toBe('R$ 256');
    expect(text(byId(host, 'rep-details'))).not.toContain(P9);
  });

  it('keeps the input red while the open panel re-reads for another account', async () => {
    connect();
    const { host } = await mountSearch();
    await type(amountInput(host), '3000');
    host
      .querySelector<HTMLButtonElement>(
        'button[aria-label="Detalhes do limite"]',
      )
      ?.click();
    await settle();
    expect(byId(host, 'rep-details')).not.toBeNull();

    chain.state.hold = true;
    connect();
    await settle();
    expect(text(host.querySelector('[role="status"]'))).toBe(
      'Verificando seu limite…',
    );
    expect(amountInput(host).getAttribute('aria-invalid')).toBe('true');
    expect(amountInput(host).className).toContain('text-red-700');
    expect(amountInput(host).hasAttribute('aria-describedby')).toBe(false);

    chain.state.held.forEach((release) => release());
    await settle();
    expect(text(byId(host, 'rep-amount'))).toBe('R$ 2256');
    expect(amountInput(host).getAttribute('aria-describedby')).toBe(
      'rep-status rep-amount',
    );
  });
});

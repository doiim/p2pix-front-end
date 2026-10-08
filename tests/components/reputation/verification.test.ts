import { afterEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import ReputationVerification from '@/components/BuyerSteps/Reputation/ReputationVerification.vue';
import { castCommands } from '@/utils/reputation';
import { mount, snapshotP3, text } from './fixtures';

const mounted: (() => void)[] = [];
afterEach(() => {
  mounted.splice(0).forEach((unmount) => unmount());
  vi.useRealTimers();
  vi.restoreAllMocks();
  Reflect.deleteProperty(navigator, 'clipboard');
});

const mountVerification = () => {
  const view = mount(ReputationVerification, {
    snapshot: snapshotP3,
    networkName: 'Arbitrum One',
  });
  mounted.push(view.unmount);
  return view;
};

const copyButton = (host: Element) =>
  Array.from(host.querySelectorAll('button')).find(
    (button) => text(button) === 'Copiar comandos',
  );

describe('ReputationVerification', () => {
  it('lists what was read and at which block', () => {
    const { host } = mountVerification();
    const cells = Array.from(host.querySelectorAll('.grid > span')).map(
      (cell) => text(cell),
    );
    expect(cells).toEqual([
      'Rede',
      'Arbitrum One',
      'Bloco',
      '#123456789',
      'P2Pix',
      '0x2222…2222',
      'Reputação',
      '0x3333…3333 (lido de P2Pix.reputation)',
      'Chave',
      'endereço << 12',
      'Crédito',
      'R$ 1000',
      'Limite',
      'limiter(1000) = 2256',
    ]);
  });

  it('copies the cast commands and shows "Copiado!" for 2s', async () => {
    vi.useFakeTimers();
    const { host } = mountVerification();
    copyButton(host)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.waitFor(() =>
      expect(text(host.querySelector('[role="status"]'))).toBe('Copiado!'),
    );
    expect(await navigator.clipboard.readText()).toBe(castCommands(snapshotP3));

    vi.advanceTimersByTime(2000);
    await nextTick();
    expect(text(host.querySelector('[role="status"]'))).toBe('');
  });

  it('selects the commands in a textarea when the clipboard is missing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
    });
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { host } = mountVerification();
    copyButton(host)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    await nextTick();

    const fallback = host.querySelector('textarea');
    expect(fallback?.value).toBe(castCommands(snapshotP3));
    expect(fallback?.readOnly).toBe(true);
    expect(document.activeElement).toBe(fallback);
    expect(text(host.querySelector('[role="status"]'))).toBe(
      'Selecionado — copie com Ctrl+C',
    );
    expect(logged).toHaveBeenCalledOnce();
  });
});

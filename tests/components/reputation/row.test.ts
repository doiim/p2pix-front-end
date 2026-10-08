import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import ReputationChecking from '@/components/BuyerSteps/Reputation/ReputationChecking.vue';
import ReputationLimitRow from '@/components/BuyerSteps/Reputation/ReputationLimitRow.vue';
import ReputationMaxButton from '@/components/BuyerSteps/Reputation/ReputationMaxButton.vue';
import { byId, mount, text } from './fixtures';

const mounted: (() => void)[] = [];
const track = <T extends { unmount: () => void }>(view: T) => {
  mounted.push(view.unmount);
  return view;
};

afterEach(() => mounted.splice(0).forEach((unmount) => unmount()));

const callExposed = (exposed: unknown, name: string) => {
  if (exposed === null || typeof exposed !== 'object' || !(name in exposed)) {
    throw new Error(`missing exposed ${name}`);
  }
  const method: unknown = Reflect.get(exposed, name);
  if (typeof method !== 'function') throw new Error(`${name} is not callable`);
  method();
};

describe('ReputationLimitRow', () => {
  it.each([
    ['over', 2256n, 'Acima do seu limite de', 'R$ 2256'],
    ['cap', 1_000_000n, 'Acima do limite máximo de', 'R$ 1.000.000'],
    [
      'refused',
      1256n,
      'O contrato recusou esta compra: seu limite atual é de',
      'R$ 1256',
    ],
  ] as const)(
    'renders the %s sentence with its ids',
    (variant, limitTokens, sentence, amount) => {
      const { host } = track(
        mount(ReputationLimitRow, { variant, limitTokens, expanded: false }),
      );
      expect(text(byId(host, 'rep-status'))).toBe(sentence);
      expect(text(byId(host, 'rep-amount'))).toBe(amount);
      expect(text(host.querySelector('p'))).toContain(`${sentence} ${amount}`);
      expect(byId(host, 'rep-tip')?.getAttribute('role')).toBe('tooltip');
      expect(text(byId(host, 'rep-tip'))).toBe(
        'Seu limite vem da reputação da sua carteira e cresce a cada compra concluída.',
      );
    },
  );

  it('wires the chevron to the panel and emits toggle', async () => {
    const toggles: string[] = [];
    const view = track(
      mount(ReputationLimitRow, {
        variant: 'refused',
        limitTokens: 1256n,
        expanded: true,
        onToggle: () => toggles.push('toggle'),
      }),
    );
    const chevron = view.host.querySelector(
      'button[aria-label="Detalhes do limite"]',
    );
    expect(chevron?.getAttribute('type')).toBe('button');
    expect(chevron?.getAttribute('aria-controls')).toBe('rep-details');
    expect(chevron?.getAttribute('aria-expanded')).toBe('true');

    view.props.expanded = false;
    await nextTick();
    expect(chevron?.getAttribute('aria-expanded')).toBe('false');

    chevron?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(toggles).toEqual(['toggle']);

    callExposed(view.exposed.value, 'focusToggle');
    expect(document.activeElement).toBe(chevron);
  });

  it('opens the tooltip on tap and closes it on Escape or a tap elsewhere', async () => {
    const { host } = track(
      mount(ReputationLimitRow, {
        variant: 'over',
        limitTokens: 2256n,
        expanded: false,
      }),
    );
    const pill = host.querySelector(
      'button[aria-label="Sobre o limite por compra"]',
    );
    const tip = byId(host, 'rep-tip');
    expect(pill?.getAttribute('aria-describedby')).toBe('rep-tip');
    expect(tip?.classList.contains('invisible')).toBe(true);
    expect(tip?.classList.contains('group-focus-within/tip:visible')).toBe(
      true,
    );

    pill?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(tip?.classList.contains('visible')).toBe(true);
    expect(tip?.classList.contains('invisible')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTick();
    expect(tip?.classList.contains('invisible')).toBe(true);
    expect(tip?.classList.contains('group-hover/tip:visible')).toBe(false);

    pill?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await nextTick();
    expect(tip?.classList.contains('visible')).toBe(true);

    document.body.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true }),
    );
    await nextTick();
    expect(tip?.classList.contains('invisible')).toBe(true);

    pill?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    await nextTick();
    expect(tip?.classList.contains('group-focus-within/tip:visible')).toBe(
      true,
    );
  });
});

describe('ReputationMaxButton', () => {
  it.each([
    ['over', 2256n, null, 'Máx: usar seu limite de R$ 2256', 225600n],
    [
      'cap',
      1_000_000n,
      200_000_000n,
      'Máx: usar o limite máximo de R$ 1.000.000',
      100_000_000n,
    ],
    ['refused', 1256n, null, 'Máx: usar seu limite atual de R$ 1256', 125600n],
    ['over', 2256n, 150050n, 'Máx: usar a maior oferta de R$ 1500,5', 150050n],
  ] as const)(
    '%s with limit %s and offer %s',
    (variant, limitTokens, maxOfferCents, label, cents) => {
      const fills: bigint[] = [];
      const view = track(
        mount(ReputationMaxButton, {
          variant,
          limitTokens,
          maxOfferCents,
          onFill: (value: bigint) => fills.push(value),
        }),
      );
      const button = view.host.querySelector('button');
      expect(button?.getAttribute('type')).toBe('button');
      expect(button?.getAttribute('aria-label')).toBe(label);
      expect(text(button)).toBe('Máx');

      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      expect(fills).toEqual([cents]);

      callExposed(view.exposed.value, 'focus');
      expect(document.activeElement).toBe(button);
    },
  );
});

describe('ReputationChecking', () => {
  it('announces the re-read and draws the skeleton', () => {
    const { host } = track(mount(ReputationChecking, {}));
    expect(text(host.querySelector('[role="status"]'))).toBe(
      'Verificando seu limite…',
    );
    expect(host.querySelectorAll('.animate-pulse')).toHaveLength(5);
    expect(
      host.querySelectorAll('.motion-reduce\\:animate-none').length,
    ).toBeGreaterThan(5);
  });
});

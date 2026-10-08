import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import ReputationChart from '@/components/BuyerSteps/Reputation/ReputationChart.vue';
import ReputationDetailsPanel from '@/components/BuyerSteps/Reputation/ReputationDetailsPanel.vue';
import ReputationNewLimitLine from '@/components/BuyerSteps/Reputation/ReputationNewLimitLine.vue';
import type { PanelTag } from '@/utils/reputation';
import { byId, mount, snapshotP3, text } from './fixtures';

const mounted: (() => void)[] = [];
afterEach(() => mounted.splice(0).forEach((unmount) => unmount()));

const mountPanel = (overrides: Record<string, unknown> = {}) => {
  const emitted: (PanelTag | null | 'close')[] = [];
  const view = mount(ReputationDetailsPanel, {
    snapshot: snapshotP3,
    networkName: 'Arbitrum One',
    accountKind: 'wallet',
    amountCents: 300000n,
    maxOfferCents: 500000n,
    limitChanged: false,
    tag: null,
    'onUpdate:tag': (tag: PanelTag | null) => emitted.push(tag),
    onClose: () => emitted.push('close'),
    ...overrides,
  });
  mounted.push(view.unmount);
  return { ...view, emitted };
};

const tagButtons = (host: Element) =>
  Array.from(host.querySelectorAll('[role="group"] button'));

const paragraphs = (host: Element) =>
  Array.from(host.querySelectorAll('#rep-details > p')).map((p) => text(p));

describe('ReputationDetailsPanel', () => {
  it('renders the default content (D4, P3)', () => {
    const { host } = mountPanel();
    const region = byId(host, 'rep-details');
    expect(region?.getAttribute('role')).toBe('region');
    expect(region?.getAttribute('aria-label')).toBe('Detalhes do limite');
    expect(paragraphs(host)).toEqual([
      'Seu limite por compra em Arbitrum One',
      'R$ 2256',
      'Esta compra passa R$ 744 do seu limite.',
      'No P2Pix cada conta tem um limite de compra por rede baseado no histórico da sua reputação para evitar fraudes.',
    ]);
    expect(tagButtons(host).map((button) => text(button))).toEqual([
      'Gráfico',
      'Como funciona',
      'Verificação',
    ]);
  });

  it('adds P9 then P4 after refusing an amount the last read said fits, when the offer binds', () => {
    const { host } = mountPanel({ limitChanged: true, maxOfferCents: 150000n });
    expect(paragraphs(host).slice(4)).toEqual([
      'Seu limite mudou desde a última leitura. Isso acontece, por exemplo, quando uma reserva expirada é devolvida: o crédito cai pela metade (nunca abaixo de R$ 100).',
      'Maior oferta em Arbitrum One agora: R$ 1500. Cada compra usa uma única oferta.',
    ]);
  });

  it('explains a new smart account on a BASE-256 network (P5)', () => {
    const { host } = mountPanel({
      snapshot: {
        ...snapshotP3,
        creditTokens: 0n,
        limiterValue: 256n,
        limitTokens: 256n,
      },
      accountKind: 'smartAccount',
      amountCents: 40000n,
    });
    expect(paragraphs(host).slice(2)).toEqual([
      'Esta compra passa R$ 144 do seu limite.',
      'No P2Pix cada conta tem um limite de compra por rede baseado no histórico da sua reputação para evitar fraudes.',
      'Esta conta inteligente ainda não tem crédito de reputação em Arbitrum One. Toda carteira começa com R$ 256 por compra.',
    ]);
  });

  it('explains a new wallet on a BASE-1 network (P6)', () => {
    const { host } = mountPanel({
      snapshot: {
        ...snapshotP3,
        creditTokens: 0n,
        limiterValue: 1n,
        limitTokens: 100n,
        baseValue: 1n,
        newWalletLimitTokens: 100n,
        curve: { base: 1n, maxLimit: 1_000_000n, magicValue: 250_000_000_000n },
      },
      networkName: 'Sepolia',
      amountCents: 15000n,
    });
    expect(paragraphs(host)).toContain(
      'Esta carteira ainda não tem crédito de reputação em Sepolia. Compras de até R$ 100 não precisam de reputação.',
    );
    expect(paragraphs(host)).toContain(
      'Esta compra passa R$ 50 do seu limite.',
    );
  });

  it('notes the contract cap (Panel-States-A #3)', () => {
    const { host } = mountPanel({
      snapshot: {
        ...snapshotP3,
        creditTokens: 22_092_000n,
        limiterValue: 1_000_255n,
        limitTokens: 1_000_000n,
        nextLimitTokens: null,
      },
      amountCents: 120_000_000n,
      maxOfferCents: null,
    });
    expect(paragraphs(host)).toContain(
      'Você atingiu o máximo do contrato: R$ 1.000.000 por compra.',
    );
  });

  it('drops the Gráfico tag when the curve was not reproduced', () => {
    const view = mountPanel({
      snapshot: { ...snapshotP3, curve: null },
      tag: 'chart',
    });
    expect(tagButtons(view.host).map((button) => text(button))).toEqual([
      'Como funciona',
      'Verificação',
    ]);
    expect(paragraphs(view.host)[0]).toBe(
      'Seu limite por compra em Arbitrum One',
    );
  });

  it('toggles tags through v-model and replaces the default content', async () => {
    const view = mountPanel();
    const [chart, howItWorks, verification] = tagButtons(view.host);
    howItWorks?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.emitted).toEqual(['howItWorks']);

    view.props.tag = 'howItWorks';
    await nextTick();
    expect(howItWorks?.getAttribute('aria-pressed')).toBe('true');
    expect(chart?.getAttribute('aria-pressed')).toBe('false');
    expect(howItWorks?.getAttribute('aria-controls')).toBe('rep-details');
    expect(text(view.host)).not.toContain(
      'Seu limite por compra em Arbitrum One',
    );
    expect(text(view.host)).toContain(
      'Comprando R$ 2256 (o máximo) e concluindo a compra, seu limite passa para cerca de R$ 6767.',
    );
    expect(view.host.querySelectorAll('li')).toHaveLength(7);
    expect(text(view.host)).toContain(
      'Limite da carteira 0x111...1111 em Arbitrum One. Cada endereço e cada rede têm sua própria reputação.',
    );
    const separators = Array.from(
      view.host.querySelectorAll('[role="group"] > span.w-px'),
    );
    expect(
      separators.map((sep) => sep.classList.contains('bg-gray-300')),
    ).toEqual([false, false]);

    howItWorks?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    verification?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(view.emitted).toEqual(['howItWorks', null, 'verification']);

    view.props.tag = null;
    await nextTick();
    expect(
      separators.map((sep) => sep.classList.contains('bg-gray-300')),
    ).toEqual([true, true]);
  });

  it('omits the next-limit sentence when the offer binds', () => {
    const { host } = mountPanel({ tag: 'howItWorks', maxOfferCents: 150000n });
    expect(text(host)).not.toContain('Comprando R$');
    expect(text(host)).toContain(
      'Cada compra acima de R$ 100 é conferida pelo contrato P2Pix',
    );
  });

  it('closes on Escape inside the panel', () => {
    const view = mountPanel();
    byId(view.host, 'rep-details')?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(view.emitted).toEqual(['close']);
  });
});

describe('ReputationChart', () => {
  const mountChart = (overrides: Record<string, unknown> = {}) => {
    const view = mount(ReputationChart, {
      curve: snapshotP3.curve,
      creditTokens: 1000n,
      limitTokens: 2256n,
      amountCents: 300000n,
      ...overrides,
    });
    mounted.push(view.unmount);
    return view;
  };

  it('draws the growth chart in both layouts (P3)', () => {
    const { host } = mountChart();
    const charts = Array.from(host.querySelectorAll('svg[role="img"]'));
    expect(charts.map((svg) => svg.getAttribute('width'))).toEqual([
      '310',
      '206',
    ]);
    charts.forEach((svg) =>
      expect(svg.getAttribute('aria-label')).toBe(
        'Gráfico do limite por compra em função do crédito de reputação. Você está em R$ 1000 de crédito, com limite de R$ 2256 por compra. Para comprar R$ 3000 de uma vez, o crédito precisa chegar a R$ 1373: mais R$ 373 em compras.',
      ),
    );
    const [wide, narrow] = charts;
    expect(
      Array.from(wide?.querySelectorAll('tspan') ?? []).map(
        (t) => t.textContent,
      ),
    ).toEqual(['Você está aqui', 'R$ 2256', 'Para comprar', 'R$ 3000']);
    expect(narrow?.querySelectorAll('tspan')).toHaveLength(0);
    expect(text(host)).toContain('Você está aqui · R$ 2256');
    expect(text(host)).toContain(
      'Para comprar R$ 3000 de uma vez, conclua antes mais R$ 373 em compras.',
    );
  });

  it('adds the flat segment sentence on a BASE-1 network (P6)', () => {
    const { host } = mountChart({
      curve: { base: 1n, maxLimit: 1_000_000n, magicValue: 250_000_000_000n },
      creditTokens: 0n,
      limitTokens: 100n,
      amountCents: 15000n,
    });
    expect(host.querySelector('svg')?.getAttribute('aria-label')).toBe(
      'Gráfico do limite por compra em função do crédito de reputação. Até R$ 49 de crédito o limite fica em R$ 100. Você está em R$ 0 de crédito, com limite de R$ 100 por compra. Para comprar R$ 150 de uma vez, o crédito precisa chegar a R$ 75: mais R$ 75 em compras.',
    );
  });

  it('draws the log chart when the cap is reached', () => {
    const { host } = mountChart({
      creditTokens: 22_092_000n,
      limitTokens: 1_000_000n,
      amountCents: 120_000_000n,
    });
    const wide = host.querySelector('svg');
    expect(wide?.getAttribute('aria-label')).toBe(
      'Gráfico do limite por compra em função do crédito de reputação, em escala logarítmica. Você está em R$ 22.092.000 de crédito, no teto de R$ 1.000.000. R$ 1.200.000 fica acima do teto.',
    );
    expect(
      Array.from(wide?.querySelectorAll('text') ?? []).map(
        (t) => t.textContent,
      ),
    ).toContain('Para comprar R$ 1.200.000');
    expect(text(host)).not.toContain('Crédito de reputação (R$)');
    expect(text(host)).toContain(
      'Nenhuma reputação permite comprar mais de R$ 1.000.000 de uma vez.',
    );
  });

  it('explains the cap without a chart while the limit is below it', () => {
    const { host } = mountChart({ amountCents: 120_000_000n });
    expect(host.querySelector('svg')).toBeNull();
    expect(text(host)).toBe(
      'Nenhuma reputação permite comprar mais de R$ 1.000.000 de uma vez.',
    );
  });

  it('renders nothing within the limit or without a curve', () => {
    expect(mountChart({ amountCents: 225600n }).host.children).toHaveLength(0);
    expect(mountChart({ curve: null }).host.children).toHaveLength(0);
  });
});

describe('ReputationNewLimitLine', () => {
  it('renders a div so the parent p rule cannot recolour it', () => {
    const view = mount(ReputationNewLimitLine, {
      networkName: 'Arbitrum One',
      beforeTokens: 2256n,
      afterTokens: 6767n,
    });
    mounted.push(view.unmount);
    const root = view.host.firstElementChild;
    expect(root?.tagName).toBe('DIV');
    expect(root?.classList.contains('text-gray-600')).toBe(true);
    expect(text(root)).toBe(
      'Seu novo limite por compra em Arbitrum One: R$ 6767 (antes R$ 2256).',
    );
    expect(text(root?.querySelector('strong') ?? null)).toBe('R$ 6767');
  });
});

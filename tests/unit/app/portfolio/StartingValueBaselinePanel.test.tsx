import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { StartingValueBaselinePanel } from '@/app/portfolio/StartingValueBaselinePanel';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Starting-Value Baseline panel — v1.17.0 Batch 2. Canonical
 * specification: `docs/STARTING_VALUE_BASELINE_SPEC.md` §11.
 *
 * Tests the component's rendering/interaction directly against a real
 * `usePortfolioStore` (reset per test), not a mock — the same "real
 * Store, real Batch 1 actions" discipline this codebase's other
 * component tests already use. Does not duplicate Batch 1's own
 * extensive store/persistence test coverage
 * (`tests/unit/stores/portfolioStore.test.ts`,
 * `tests/unit/services/portfolio/startingValueBaseline.test.ts`) — only
 * what's needed to prove this component renders and wires them
 * correctly.
 */
const INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  usePortfolioStore.setState(INITIAL_STATE);
  window.localStorage.clear();
});

function validInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    settings: {},
    ...overrides,
  };
}

function createValidPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

/**
 * Reactively re-reads the portfolio from the Store on every render — the
 * same "parent passes the always-fresh record" behavior
 * `app/portfolio/PortfolioPageClient.tsx` provides in production
 * (`record.portfolio`, selected from `usePortfolioStore`). The panel
 * itself stays a pure props-in component, matching
 * `PortfolioHistoryPanel.tsx`'s own established prop-drilling
 * convention — this wrapper exists only so a click that mutates the
 * Store is reflected back into what's rendered, exactly as it is on the
 * real page.
 */
function Harness({ portfolioId }: { portfolioId: string }) {
  const portfolio = usePortfolioStore((state) => state.portfolios[portfolioId]?.portfolio);
  if (portfolio === undefined) return null;
  return <StartingValueBaselinePanel portfolioId={portfolioId} portfolio={portfolio} />;
}

describe('StartingValueBaselinePanel — no-baseline state (A, B, P)', () => {
  it('explains that no baseline is established and offers "Set Baseline Now"', () => {
    const portfolio = createValidPortfolio();
    render(<Harness portfolioId={portfolio.id} />);

    expect(screen.getByRole('heading', { level: 2, name: 'Performance' })).toBeInTheDocument();
    expect(screen.getByText(/no baseline has been established/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Baseline Now' })).toBeInTheDocument();
  });

  it('clicking "Set Baseline Now" invokes the committed Batch 1 setBaseline action and the panel updates', async () => {
    const user = userEvent.setup();
    const portfolio = createValidPortfolio();
    render(<Harness portfolioId={portfolio.id} />);

    await user.click(screen.getByRole('button', { name: 'Set Baseline Now' }));

    const stored = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(stored.establishedAt).toEqual(expect.any(String));
    expect(stored.collateralQuantity).toBe(2);
    expect(stored.marketPriceUsd).toBe(50000);
    expect(
      screen.getByRole('heading', { level: 2, name: /^Performance since/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Set Baseline Now' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset Baseline' })).toBeInTheDocument();
  });

  it('does not automatically establish a baseline, infer one from history, or use portfolio creation time', () => {
    const portfolio = createValidPortfolio();
    render(<Harness portfolioId={portfolio.id} />);

    const stored = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(stored.establishedAt).toBeUndefined();
    expect(stored.collateralQuantity).toBeUndefined();
    expect(stored.marketPriceUsd).toBeUndefined();
  });
});

describe('StartingValueBaselinePanel — established/current state (C, D, E, F, G, H)', () => {
  it('renders baseline date (heading), baseline value, current value, and change since baseline', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 50000 },
    });
    const baselined = usePortfolioStore.getState().setBaseline(portfolio.id);
    if (!baselined.ok) throw new Error('setup failed');
    // Price moves after baseline, quantity unchanged.
    usePortfolioStore.getState().setMarket(portfolio.id, { btcPriceUsd: 60000 });

    render(<Harness portfolioId={portfolio.id} />);

    expect(
      screen.getByRole('heading', {
        level: 2,
        name: new RegExp(`^Performance since .+`),
      }),
    ).toBeInTheDocument();

    const dtNodes = screen.getAllByRole('term');
    const ddNodes = screen.getAllByRole('definition');
    const labels = dtNodes.map((node) => node.textContent);
    expect(labels).toEqual(['Baseline value', 'Current value', 'Change since baseline']);
    expect(ddNodes[0].textContent).toBe('$100,000.00');
    expect(ddNodes[1].textContent).toBe('$120,000.00');
    expect(ddNodes[2].textContent).toBe('+$20,000.00 (+20%)');
  });

  it('renders a negative change without clamping', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 50000 },
    });
    usePortfolioStore.getState().setBaseline(portfolio.id);
    usePortfolioStore.getState().setMarket(portfolio.id, { btcPriceUsd: 40000 });

    render(<Harness portfolioId={portfolio.id} />);

    const ddNodes = screen.getAllByRole('definition');
    expect(ddNodes[2].textContent).toBe('-$20,000.00 (-20%)');
  });

  it('never renders forbidden terminology (P&L, profit, return, cost basis)', () => {
    const portfolio = createValidPortfolio();
    usePortfolioStore.getState().setBaseline(portfolio.id);
    render(<Harness portfolioId={portfolio.id} />);

    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/cost basis/i);
    expect(text).not.toMatch(/acquisition cost/i);
    expect(text).not.toMatch(/p&l/i);
    expect(text).not.toMatch(/profit/i);
    expect(text).not.toMatch(/\btotal return\b/i);
  });
});

describe('StartingValueBaselinePanel — composition-changed state (I, J)', () => {
  it('shows a "Composition changed since baseline" status and still displays the qualified figures, without suppressing the stored baseline', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 50000 },
    });
    const baselined = usePortfolioStore.getState().setBaseline(portfolio.id);
    if (!baselined.ok) throw new Error('setup failed');
    usePortfolioStore
      .getState()
      .update(portfolio.id, { collateral: { asset: 'BTC', quantity: 3 } });

    render(<Harness portfolioId={portfolio.id} />);

    expect(screen.getByText(/composition changed since baseline/i)).toBeInTheDocument();
    // Baseline's own recorded facts remain displayed, not suppressed.
    const stored = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(stored.collateralQuantity).toBe(2);
    expect(stored.marketPriceUsd).toBe(50000);
    const ddNodes = screen.getAllByRole('definition');
    expect(ddNodes[0].textContent).toBe('$100,000.00');
    expect(ddNodes[1].textContent).toBe('$150,000.00');
  });

  it('a price-only change (quantity unchanged) never shows the composition-changed status', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 50000 },
    });
    usePortfolioStore.getState().setBaseline(portfolio.id);
    usePortfolioStore.getState().setMarket(portfolio.id, { btcPriceUsd: 999999 });

    render(<Harness portfolioId={portfolio.id} />);

    expect(screen.queryByText(/composition changed/i)).not.toBeInTheDocument();
  });
});

describe('StartingValueBaselinePanel — zero-baseline-value edge case (K)', () => {
  it('renders percentage change as unavailable, never NaN/Infinity, with absolute change still shown', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 0 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 50000 },
    });
    const baselined = usePortfolioStore.getState().setBaseline(portfolio.id);
    if (!baselined.ok) throw new Error('setup failed');
    expect(baselined.data.collateralQuantity).toBe(0);
    usePortfolioStore
      .getState()
      .update(portfolio.id, { collateral: { asset: 'BTC', quantity: 1 } });

    render(<Harness portfolioId={portfolio.id} />);

    const ddNodes = screen.getAllByRole('definition');
    expect(ddNodes[0].textContent).toBe('$0.00');
    expect(ddNodes[2].textContent).toBe('+$50,000.00 (—)');
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/NaN/);
    expect(text).not.toMatch(/Infinity/);
  });
});

describe('StartingValueBaselinePanel — reset/replacement (L)', () => {
  it('"Reset Baseline" replaces all three recorded fields with the current state, with no confirmation dialog', async () => {
    const user = userEvent.setup();
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 50000 },
    });
    const first = usePortfolioStore.getState().setBaseline(portfolio.id);
    if (!first.ok) throw new Error('setup failed');
    usePortfolioStore.getState().update(portfolio.id, {
      collateral: { asset: 'BTC', quantity: 5 },
      market: { btcPriceUsd: 70000 },
    });

    render(<Harness portfolioId={portfolio.id} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset Baseline' }));

    const stored = usePortfolioStore.getState().portfolios[portfolio.id].portfolio;
    expect(stored.collateralQuantity).toBe(5);
    expect(stored.marketPriceUsd).toBe(70000);
    expect(stored.establishedAt).not.toBe(first.data.establishedAt);
    expect(screen.queryByText(/composition changed/i)).not.toBeInTheDocument();
  });
});

describe('StartingValueBaselinePanel — manual/V3/V4 parity (M, N, O)', () => {
  it('behaves identically for a manual (V3-shaped, no protocolVersion set) portfolio', () => {
    const portfolio = createValidPortfolio();
    usePortfolioStore.getState().setBaseline(portfolio.id);
    render(<Harness portfolioId={portfolio.id} />);
    expect(screen.getByRole('button', { name: 'Reset Baseline' })).toBeInTheDocument();
  });

  it('behaves identically for a V3 portfolio', () => {
    const portfolio = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, undefined);
    usePortfolioStore.getState().setBaseline(portfolio.id);
    render(<Harness portfolioId={portfolio.id} />);
    expect(screen.getByRole('button', { name: 'Reset Baseline' })).toBeInTheDocument();
  });

  it('behaves identically for a V4 portfolio with synced debt state', () => {
    const portfolio = createValidPortfolio();
    usePortfolioStore.getState().setProtocolVersion(portfolio.id, 'v4');
    usePortfolioStore
      .getState()
      .setAaveV4CollateralRisk(
        portfolio.id,
        { collateralFactor: 0.75, dynamicConfigKey: 3 },
        'manual',
      );
    usePortfolioStore
      .getState()
      .setAaveV4DebtState(
        portfolio.id,
        { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
        'manual',
      );
    const baselined = usePortfolioStore.getState().setBaseline(portfolio.id);
    expect(baselined.ok).toBe(true);

    render(<Harness portfolioId={portfolio.id} />);
    expect(screen.getByRole('button', { name: 'Reset Baseline' })).toBeInTheDocument();
    const ddNodes = screen.getAllByRole('definition');
    expect(ddNodes[0].textContent).toBe('$100,000.00');
  });
});

describe('StartingValueBaselinePanel — accessibility (P, Q)', () => {
  it('the panel heading is a real <h2>, and both actions have descriptive accessible names', async () => {
    const user = userEvent.setup();
    const portfolio = createValidPortfolio();
    render(<Harness portfolioId={portfolio.id} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Baseline Now' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Set Baseline Now' }));
    expect(screen.getByRole('button', { name: 'Reset Baseline' })).toBeInTheDocument();
  });

  it('the composition-changed status is conveyed in text, not color alone, and programmatically associated with the figures', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      market: { btcPriceUsd: 50000 },
    });
    usePortfolioStore.getState().setBaseline(portfolio.id);
    usePortfolioStore
      .getState()
      .update(portfolio.id, { collateral: { asset: 'BTC', quantity: 3 } });

    render(<Harness portfolioId={portfolio.id} />);

    const statusText = screen.getByText(/composition changed since baseline/i);
    expect(statusText.tagName).toBe('P');
    const dl = document.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(dl?.getAttribute('aria-describedby')).toBe(statusText.id);
  });

  it('the unavailable percentage change has understandable text, not a raw symbol', () => {
    const portfolio = createValidPortfolio({
      collateral: { asset: 'BTC', quantity: 0 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 50000 },
    });
    usePortfolioStore.getState().setBaseline(portfolio.id);
    usePortfolioStore
      .getState()
      .update(portfolio.id, { collateral: { asset: 'BTC', quantity: 1 } });

    render(<Harness portfolioId={portfolio.id} />);
    const ddNodes = screen.getAllByRole('definition');
    expect(ddNodes[2].textContent).toContain('—');
  });
});

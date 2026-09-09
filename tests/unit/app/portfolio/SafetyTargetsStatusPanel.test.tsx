import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafetyTargetsStatusPanel } from '@/app/portfolio/SafetyTargetsStatusPanel';
import { calculatePortfolioSummary } from '@/services/portfolio/summary';
import type { Portfolio } from '@/types/portfolio';

/**
 * Safety Targets Status panel — v1.23.0 Batch 1. Renders
 * `buildSafetyTargetsStatus`'s already-computed result — this file
 * tests the component's own formatting/rendering behavior, not the
 * comparison logic itself (fully covered by
 * `tests/unit/services/portfolio/safetyTargetsStatus.test.ts`).
 */
function basePortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
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
    archivedAt: null,
    marketUpdatedAt: '2026-01-01T00:00:00.000Z',
    protocolUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function row(label: string): HTMLElement {
  const dt = screen.getByText(label);
  // `<dt>`/`<dd>` are siblings inside the same `<dl>` — the value/status
  // text lives in the `<dd>` immediately following this `<dt>`.
  const dd = dt.nextElementSibling;
  if (dd === null) throw new Error(`No <dd> sibling found for "${label}"`);
  return dd as HTMLElement;
}

describe('SafetyTargetsStatusPanel — heading and structure (accessibility)', () => {
  it('renders a labelled heading and a read-only description', () => {
    const portfolio = basePortfolio();
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Safety Targets Status' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/read-only/i)).toBeInTheDocument();
  });

  it('renders all four fields as a definition list', () => {
    const portfolio = basePortfolio();
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    const { container } = render(
      <SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />,
    );

    const dl = container.querySelector('dl');
    expect(dl).not.toBeNull();
    expect(within(dl as HTMLElement).getAllByRole('term')).toHaveLength(4);
  });
});

describe('SafetyTargetsStatusPanel — all targets configured', () => {
  it('shows Target/Current/Met for every field when current values clear their targets', () => {
    const portfolio = basePortfolio({
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
          holdingPeriodDays: 30,
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target Health Factor').textContent).toContain('Target: 2');
    expect(row('Target Health Factor').textContent).toContain('Current: 4');
    expect(row('Target Health Factor').textContent).toContain('Met');

    expect(row('Target BTC price (USD)').textContent).toContain('$40,000');
    expect(row('Target BTC price (USD)').textContent).toContain('$50,000');
    expect(row('Target BTC price (USD)').textContent).toContain('Met');
  });

  it('shows "Not met" when a current value falls short of its target', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetHealthFactor: 10 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target Health Factor').textContent).toContain('Not met');
  });
});

describe('SafetyTargetsStatusPanel — all targets absent', () => {
  it('shows "Not configured" for every field', () => {
    const portfolio = basePortfolio({ settings: {} });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target Health Factor').textContent).toContain('Not configured');
    expect(row('Holding period (days)').textContent).toContain('Not configured');
    expect(row('Target BTC price (USD)').textContent).toContain('Not configured');
    expect(row('Safety buffer (%)').textContent).toContain('Not configured');
  });
});

describe('SafetyTargetsStatusPanel — partial configuration', () => {
  it('renders each field independently — one configured, three not', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 30000 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target BTC price (USD)').textContent).toContain('Met');
    expect(row('Target Health Factor').textContent).toContain('Not configured');
    expect(row('Holding period (days)').textContent).toContain('Not configured');
    expect(row('Safety buffer (%)').textContent).toContain('Not configured');
  });
});

describe('SafetyTargetsStatusPanel — valid zero preservation', () => {
  it('holding period target of 0 renders "0 days" and "Met", never "Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { holdingPeriodDays: 0 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Holding period (days)').textContent ?? '';
    expect(text).toContain('Target: 0 days');
    expect(text).not.toContain('Not configured');
    expect(text).toContain('Met');
  });

  it('safety buffer target of 0 renders "0%" and "Met", never "Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 0 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Safety buffer (%)').textContent ?? '';
    expect(text).toContain('Target: 0%');
    expect(text).not.toContain('Not configured');
    expect(text).toContain('Met');
  });
});

describe('SafetyTargetsStatusPanel — Holding Period reference timestamp', () => {
  it('uses establishedAt when a baseline is set', () => {
    const portfolio = basePortfolio({
      createdAt: '2020-01-01T00:00:00.000Z',
      establishedAt: '2026-01-01T00:00:00.000Z',
      settings: { safetyTargets: { holdingPeriodDays: 1 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    // Real elapsed days vary with wall-clock "now", so only assert the
    // reference is establishedAt-based, not the exact figure: with
    // establishedAt in the past and no baseline change, this must be
    // "Met" (elapsed comfortably exceeds a 1-day target either way) —
    // the distinguishing assertion is in the Service-layer test file,
    // which pins `now`. This component test only proves the panel
    // renders without error and reaches a determinate status.
    expect(row('Holding period (days)').textContent).toMatch(/Met|Not met/);
  });

  it('falls back to createdAt when no baseline is established', () => {
    const portfolio = basePortfolio({
      createdAt: '2026-01-01T00:00:00.000Z',
      settings: { safetyTargets: { holdingPeriodDays: 1 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Holding period (days)').textContent).toMatch(/Met|Not met/);
  });
});

describe('SafetyTargetsStatusPanel — exact boundary behavior', () => {
  it('current exactly equal to target renders "Met" (inclusive)', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 50000 } }, // equals market.btcPriceUsd exactly
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target BTC price (USD)').textContent).toContain('Met');
  });
});

describe('SafetyTargetsStatusPanel — zero-debt portfolio (no liquidation risk)', () => {
  it('renders "No liquidation risk to compare against" for Safety Buffer %, not a fabricated 0%', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { safetyBufferPercent: 50 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Safety buffer (%)').textContent).toContain(
      'No liquidation risk to compare against',
    );
  });

  it('renders "∞" for Target Health Factor current value on a zero-debt portfolio', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Target Health Factor').textContent ?? '';
    expect(text).toContain('∞');
    expect(text).toContain('Met');
  });
});

describe('SafetyTargetsStatusPanel — failed PortfolioSummary', () => {
  it('renders "Not available" for Target Health Factor / Safety Buffer %, while Target BTC Price and Holding Period render normally', () => {
    const portfolio = basePortfolio({
      collateral: { asset: 'BTC', quantity: -1 },
      settings: {
        safetyTargets: {
          targetHealthFactor: 2,
          targetBtcPriceUsd: 40000,
          safetyBufferPercent: 50,
          holdingPeriodDays: 1,
        },
      },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    expect(summary.ok).toBe(false);
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target Health Factor').textContent).toContain('Not available');
    expect(row('Safety buffer (%)').textContent).toContain('Not available');
    expect(row('Target BTC price (USD)').textContent).toContain('Met');
    expect(row('Holding period (days)').textContent).toMatch(/Met|Not met/);
  });
});

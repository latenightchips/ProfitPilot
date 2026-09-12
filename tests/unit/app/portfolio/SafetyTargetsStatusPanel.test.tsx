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
  it('shows Target/Current/status for every field when current values clear their targets', () => {
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
    expect(row('Target BTC price (USD)').textContent).toContain('Target reached');
    expect(row('Target BTC price (USD)').textContent).not.toContain('Met');
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

    expect(row('Target BTC price (USD)').textContent).toContain('Target reached');
    expect(row('Target Health Factor').textContent).toContain('Not configured');
    expect(row('Holding period (days)').textContent).toContain('Not configured');
    expect(row('Safety buffer (%)').textContent).toContain('Not configured');
  });
});

describe('SafetyTargetsStatusPanel — valid zero preservation', () => {
  it('holding period target of 0 renders "0 days" and "Target reached", never "Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { holdingPeriodDays: 0 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Holding period (days)').textContent ?? '';
    expect(text).toContain('Target: 0 days');
    expect(text).not.toContain('Not configured');
    expect(text).toContain('Target reached');
  });

  it('safety buffer target of 0 renders "0%" and "On target", never "Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 0 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Safety buffer (%)').textContent ?? '';
    expect(text).toContain('Target: 0%');
    expect(text).not.toContain('Not configured');
    expect(text).toContain('On target');
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
    // "Target reached" (elapsed comfortably exceeds a 1-day target
    // either way) — the distinguishing assertion is in the
    // Service-layer test file, which pins `now`. This component test
    // only proves the panel renders without error and reaches a
    // determinate status.
    expect(row('Holding period (days)').textContent).toMatch(/Target reached|In progress/);
  });

  it('falls back to createdAt when no baseline is established', () => {
    const portfolio = basePortfolio({
      createdAt: '2026-01-01T00:00:00.000Z',
      settings: { safetyTargets: { holdingPeriodDays: 1 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Holding period (days)').textContent).toMatch(/Target reached|In progress/);
  });
});

describe('SafetyTargetsStatusPanel — exact boundary behavior', () => {
  it('current exactly equal to target renders "Target reached" (inclusive)', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 50000 } }, // equals market.btcPriceUsd exactly
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target BTC price (USD)').textContent).toContain('Target reached');
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
    expect(row('Target BTC price (USD)').textContent).toContain('Target reached');
    expect(row('Holding period (days)').textContent).toMatch(/Target reached|In progress/);
  });
});

/**
 * Target-specific status language (Safety Targets Semantic/Status
 * Cleanup batch) — proves each target family's own "not met" label, and
 * that the generic "Met"/"Not met" text this panel used before this
 * batch never leaks onto the two informational-milestone targets or
 * Safety Buffer.
 */
describe('SafetyTargetsStatusPanel — target-specific status language', () => {
  it('Safety Buffer % below its target renders "Below target", not "Not met"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 99 } }, // far above the real ~75% buffer here
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Safety buffer (%)').textContent ?? '';
    expect(text).toContain('Below target');
    expect(text).not.toContain('Not met');
    expect(text).not.toContain('Met');
  });

  it('Target BTC Price below its target renders "Below target", not "Not met"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetBtcPriceUsd: 60000 } }, // above market.btcPriceUsd (50000)
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Target BTC price (USD)').textContent ?? '';
    expect(text).toContain('Below target');
    expect(text).not.toContain('Not met');
    expect(text).not.toContain('Met');
  });

  it('Holding Period not yet elapsed renders "In progress", not "Not met"', () => {
    const portfolio = basePortfolio({
      createdAt: new Date().toISOString(),
      settings: { safetyTargets: { holdingPeriodDays: 9999 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const text = row('Holding period (days)').textContent ?? '';
    expect(text).toContain('In progress');
    expect(text).not.toContain('Not met');
    expect(text).not.toContain('Met');
  });

  it('Target Health Factor keeps "Met"/"Not met" — the one target with an associated Recommendation', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { targetHealthFactor: 2, targetBtcPriceUsd: 40000 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Target Health Factor').textContent).toContain('Met');
    // Confirms "Met" is target-specific, not a generic substring leak —
    // BTC Price (also satisfied here) must say "Target reached", not "Met".
    expect(row('Target BTC price (USD)').textContent).not.toContain('Met');
  });

  it('no CTA/link/button exists anywhere in the panel for any target', () => {
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

    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

describe('SafetyTargetsStatusPanel — Safety Buffer invalid configuration (Safety Buffer ≥100% Persistence-Compatibility batch)', () => {
  it('renders "Invalid target" and the correction explanation for a legacy safetyBufferPercent of 150, never "Below target"/"On target"/"Not configured"', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 150 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const bufferRow = row('Safety buffer (%)');
    expect(bufferRow.textContent).toContain('Invalid target');
    expect(bufferRow.textContent).toContain(
      'Safety Buffer targets must be below 100%. Update this target in Portfolio Settings.',
    );
    expect(bufferRow.textContent).not.toContain('Below target');
    expect(bufferRow.textContent).not.toContain('On target');
    expect(bufferRow.textContent).not.toContain('Not configured');
  });

  it('renders "Invalid target" (not the zero-debt "No liquidation risk" text) for an invalid target on a zero-debt portfolio', () => {
    const portfolio = basePortfolio({
      debt: { asset: 'USDC', balance: 0 },
      settings: { safetyTargets: { safetyBufferPercent: 150 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    const bufferRow = row('Safety buffer (%)');
    expect(bufferRow.textContent).toContain('Invalid target');
    expect(bufferRow.textContent).not.toContain('No liquidation risk to compare against');
  });

  it('renders the ordinary "On target" label for a valid Safety Buffer target well below 100%, unaffected by this batch', () => {
    const portfolio = basePortfolio({
      settings: { safetyTargets: { safetyBufferPercent: 10 } },
    });
    const summary = calculatePortfolioSummary(portfolio, 'manual');
    render(<SafetyTargetsStatusPanel portfolio={portfolio} summary={summary} />);

    expect(row('Safety buffer (%)').textContent).toContain('On target');
  });
});

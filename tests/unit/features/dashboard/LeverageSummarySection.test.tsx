import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { buildLeverageSummary, LeverageSummarySection } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Leverage Summary Section — 06_TASKS.md M5-014.
 */
beforeEach(() => {
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
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

function buildSection() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  return buildLeverageSummary(record.summary.data);
}

describe('LeverageSummarySection — Include list', () => {
  it('renders gross exposure, net equity, leverage ratio, effective BTC exposure, and an explanation', () => {
    render(<LeverageSummarySection summary={buildSection()} />);
    expect(screen.getByText('Gross Exposure')).toBeInTheDocument();
    expect(screen.getByText('Net Equity')).toBeInTheDocument();
    expect(screen.getByText('Leverage Ratio')).toBeInTheDocument();
    expect(screen.getByText('Effective BTC Exposure')).toBeInTheDocument();
    expect(screen.getByText(/This portfolio is leveraged/)).toBeInTheDocument();
  });
});

describe('LeverageSummarySection — Debt-to-equity ratio is not rendered (M2-008 precedent)', () => {
  it('never mentions a debt-to-equity ratio', () => {
    render(<LeverageSummarySection summary={buildSection()} />);
    expect(screen.queryByText(/[Dd]ebt.to.equity/)).not.toBeInTheDocument();
  });
});

describe('LeverageSummarySection — zero debt (M5-025, Batch 15)', () => {
  it('renders an exact 1.00x leverage ratio and the "not leveraged" explanation, not a division-by-zero artifact', () => {
    const created = usePortfolioStore
      .getState()
      .create(validInput({ debt: { asset: 'USDC', balance: 0 } }));
    if (!created.ok) throw new Error('setup failed');
    const record = usePortfolioStore.getState().portfolios[created.data.id];
    if (!record.summary.ok) throw new Error('expected a successful summary');
    const summary = buildLeverageSummary(record.summary.data);

    render(<LeverageSummarySection summary={summary} />);

    expect(record.summary.data.leverage).toBe(1);
    expect(screen.getByText(summary.formattedLeverageRatio)).toBeInTheDocument();
    expect(
      screen.getByText(
        'This portfolio is not leveraged — your net equity equals your total Bitcoin exposure.',
      ),
    ).toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildDashboardViewModel,
  buildPortfolioComposition,
  PortfolioCompositionSection,
} from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio Composition Section — 06_TASKS.md M5-011. DoD: "Users can
 * understand what contributes to total collateral and debt."
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

function buildComposition() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  const record = usePortfolioStore.getState().portfolios[created.data.id];
  if (!record.summary.ok) throw new Error('expected a successful summary');
  const viewModel = buildDashboardViewModel(record.portfolio, record.summary);
  if (!viewModel.ok) throw new Error('expected a successful view model');
  return buildPortfolioComposition(
    record.portfolio,
    record.summary.data,
    viewModel.freshness.market,
    {
      engineVersion: record.summary.metadata.engineVersion,
      formulaVersion: record.summary.metadata.formulaVersion,
    },
  );
}

describe('PortfolioCompositionSection — table and compact cards render the same data', () => {
  it('renders both the table (hidden below sm:) and the compact cards (hidden at sm: and up)', () => {
    render(<PortfolioCompositionSection composition={buildComposition()} />);
    // Both renderings exist in the DOM at once; Tailwind's `hidden`/`sm:hidden`
    // classes control which is visually shown at a given viewport, not React.
    expect(screen.getAllByText('BTC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('USDC').length).toBeGreaterThan(0);
    expect(screen.getAllByText('$100,000.00').length).toBeGreaterThan(0);
  });
});

describe('PortfolioCompositionSection — responsive table container (M5-023, Batch 12)', () => {
  it('wraps the table in an overflow-x-auto container so it scrolls locally, not the page', () => {
    render(<PortfolioCompositionSection composition={buildComposition()} />);
    const table = screen.getByRole('table');
    expect(table.parentElement).toHaveClass('overflow-x-auto');
  });
});

describe('PortfolioCompositionSection — table semantics (M5-024, Batch 13)', () => {
  it('marks every header cell scope="col" so a screen reader can announce column membership', () => {
    render(<PortfolioCompositionSection composition={buildComposition()} />);
    const headers = screen.getAllByRole('columnheader');
    expect(headers.length).toBe(6);
    for (const header of headers) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });
});

describe('PortfolioCompositionSection — protocol parameters', () => {
  it('renders every protocol parameter', () => {
    render(<PortfolioCompositionSection composition={buildComposition()} />);
    expect(screen.getByText(/Maximum LTV: 75%/)).toBeInTheDocument();
    expect(screen.getByText(/Liquidation Threshold: 80%/)).toBeInTheDocument();
    expect(screen.getByText(/Borrow APR: 5%/)).toBeInTheDocument();
    expect(screen.getByText(/Supply APR: 2%/)).toBeInTheDocument();
  });
});

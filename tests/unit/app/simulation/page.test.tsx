import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import SimulationPage from '@/app/simulation/page';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace") + M6-004 ("Create Scenario Builder", Batch 3). DoD:
 * "Users can access the Simulation Workspace from the Dashboard";
 * "Scenario inputs are validated before calculation."
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

function selectActivePortfolio() {
  const created = usePortfolioStore.getState().create(validInput());
  if (!created.ok) throw new Error('setup failed');
  usePortfolioStore.getState().select(created.data.id);
}

describe('SimulationPage — no active portfolio (M6-001)', () => {
  it('guides the user to select or create one, rather than rendering an empty Scenario Builder', () => {
    render(<SimulationPage />);
    expect(screen.getByRole('heading', { name: 'Simulation', level: 1 })).toBeInTheDocument();
    expect(screen.getByText(/No portfolio is currently selected/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Select or create one' })).toHaveAttribute(
      'href',
      '/portfolios',
    );
    expect(screen.queryByRole('heading', { name: 'Scenario Controls' })).not.toBeInTheDocument();
  });
});

describe('SimulationPage — active portfolio (M6-001, M6-004)', () => {
  it('renders the three named regions from M6-001’s own Include list, plus Scenario Charts (M6-011, Batch 10)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByRole('heading', { name: 'Scenario Controls' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Simulation Results' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Portfolio Comparison' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scenario Charts' })).toBeInTheDocument();
  });

  it('exposes the Scenario Controls region as a landmark for assistive technology', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByRole('complementary', { name: 'Scenario Controls' })).toBeInTheDocument();
  });

  it('renders the Scenario Builder’s own BTC Price input, pre-filled with the portfolio’s current price', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByLabelText('BTC Price')).toHaveValue(50000);
  });

  it('does not render the Milestone 1 placeholder text anymore', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.queryByText(/scaffolded in Milestone 1/)).not.toBeInTheDocument();
  });

  it('renders the real Scenario Summary in place of the M6-001 Simulation Results placeholder (M6-009, Batch 8)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText('Change a scenario input to see results here.')).toBeInTheDocument();
  });

  it('renders the real Scenario Comparison in place of the M6-001 Portfolio Comparison placeholder (M6-010, Batch 9)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(screen.getByText(/No scenarios saved yet/)).toBeInTheDocument();
    expect(
      screen.queryByText('Implemented in a later Milestone 6 batch — see PROJECT_STATUS.md.'),
    ).not.toBeInTheDocument();
  });

  it('renders the real Scenario Charts section (M6-011, Batch 10)', () => {
    selectActivePortfolio();
    render(<SimulationPage />);
    expect(
      screen.getByText('Select scenarios in Portfolio Comparison above to see charts.'),
    ).toBeInTheDocument();
  });
});

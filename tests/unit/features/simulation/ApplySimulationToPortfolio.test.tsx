import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplySimulationToPortfolio } from '@/features/simulation';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/** `ApplySimulationToPortfolio` — V1.1 Batch 3, Section 4. */
const SIMULATION_INITIAL_STATE = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  portfolioActionInput: null,
  savedScenarios: [],
  comparisonSelection: [],
  timelineProjection: null,
  lastMetadata: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  previewMode: false,
};

const PORTFOLIO_INITIAL_STATE = {
  portfolios: {},
  activePortfolioId: null,
  loadStatus: 'idle' as const,
  saveStatus: 'idle' as const,
  errors: [],
  lastSynchronizedAt: null,
};

beforeEach(() => {
  useSimulationStore.setState(SIMULATION_INITIAL_STATE);
  usePortfolioStore.setState(PORTFOLIO_INITIAL_STATE);
  window.localStorage.clear();
});

function createValidPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create({
    name: 'My Portfolio',
    baseCurrency: 'USD',
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: { maxLoanToValue: 0.75, liquidationThreshold: 0.8, borrowApr: 0.05, supplyApr: 0.02 },
    settings: {},
    ...overrides,
  });
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('ApplySimulationToPortfolio — empty state', () => {
  it('prompts to run a Portfolio Action before any has run', () => {
    const portfolio = createValidPortfolio();
    render(<ApplySimulationToPortfolio portfolio={portfolio} />);
    expect(screen.getByText(/Run a Portfolio Action/i)).toBeInTheDocument();
  });

  it('does not render for a price/interest scenario — only portfolioActionInput gates it (Section 4)', () => {
    const portfolio = createValidPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);
    expect(useSimulationStore.getState().currentResult).not.toBeNull();

    render(<ApplySimulationToPortfolio portfolio={portfolio} />);
    expect(screen.getByText(/Run a Portfolio Action/i)).toBeInTheDocument();
  });
});

describe('ApplySimulationToPortfolio — review then apply', () => {
  it('shows the disclaimer, then writes the real proposed collateral/debt on confirm', () => {
    const portfolio = createValidPortfolio();
    useSimulationStore.getState().runPortfolioActionSimulation(portfolio, {
      collateralDelta: 0.5,
      debtDelta: 5000,
    });
    expect(useSimulationStore.getState().portfolioActionPreview).not.toBeNull();

    render(<ApplySimulationToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));
    expect(screen.getByText(/does not execute transactions on Aave/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Apply to Portfolio$/i }));

    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.collateral.quantity).toBe(2.5);
    expect(record.portfolio.debt.balance).toBe(25000);
    expect(screen.getByRole('status')).toHaveTextContent('Applied to portfolio.');
  });

  it('Cancel discards the review without mutating the portfolio', () => {
    const portfolio = createValidPortfolio();
    useSimulationStore.getState().runPortfolioActionSimulation(portfolio, {
      collateralDelta: 0.5,
      debtDelta: 5000,
    });
    const applyPortfolioState = vi.spyOn(usePortfolioStore.getState(), 'applyPortfolioState');

    render(<ApplySimulationToPortfolio portfolio={portfolio} />);
    fireEvent.click(screen.getByRole('button', { name: /Review Apply to Portfolio/i }));
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));

    expect(applyPortfolioState).not.toHaveBeenCalled();
    const record = usePortfolioStore.getState().portfolios[portfolio.id];
    expect(record.portfolio.collateral.quantity).toBe(2);
    applyPortfolioState.mockRestore();
  });
});

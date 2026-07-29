import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SimulationWarnings } from '@/features/simulation';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Simulation Warnings — 06_TASKS.md M6-014 ("Implement Simulation
 * Warnings"). DoD: "Warnings explain both the cause and potential
 * impact." Every assertion below checks a value the real
 * `buildSimulationWarnings` (driven by the real Store) actually
 * computed, never a hand-crafted mock result.
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
  useSimulationStore.getState().reset();
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

function createPortfolio(overrides: Record<string, unknown> = {}): Portfolio {
  const result = usePortfolioStore.getState().create(validInput(overrides));
  if (!result.ok) throw new Error('setup failed');
  return result.data;
}

describe('SimulationWarnings — empty state', () => {
  it('prompts the user to run a simulation, rather than rendering empty warnings', () => {
    const portfolio = createPortfolio();
    render(<SimulationWarnings portfolio={portfolio} />);
    expect(screen.getByText('Run a simulation to see any warnings.')).toBeInTheDocument();
  });
});

describe('SimulationWarnings — no warnings triggered', () => {
  it('shows positive confirmation text, not an empty section', () => {
    const portfolio = createPortfolio();
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByText('No warnings for this simulation.')).toBeInTheDocument();
    expect(
      screen.getByText(/Near liquidation, Invalid assumptions, High leverage/),
    ).toBeInTheDocument();
  });
});

describe('SimulationWarnings — Unsafe Health Factor (real Store + real Portfolio)', () => {
  it('warns when the simulated Health Factor drops below the portfolio’s own configured target', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    // 2 BTC * $20,000 = $40,000 collateral; $20,000 debt * 0.8 liquidation
    // threshold / $20,000 debt = Health Factor 1.6 — well below the
    // configured target of 5.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 20000 },
    });
    useSimulationStore.getState().runSimulation(portfolio);

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/is below your configured target \(5\)/)).toBeInTheDocument();
    expect(screen.getByText(/increases your risk of losing collateral/)).toBeInTheDocument();
  });

  it('also fires for a portfolio action result, not just price/interest scenarios', () => {
    const portfolio = createPortfolio({
      settings: { safetyTargets: { targetHealthFactor: 5 } },
    });
    // 0.1 BTC * $50,000 = $5,000 collateral remaining; Health Factor =
    // ($5,000 * 0.8) / $20,000 = 0.2 — well below the configured target.
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(portfolio, { collateralDelta: -1.9, debtDelta: 0 });

    render(<SimulationWarnings portfolio={portfolio} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/is below your configured target \(5\)/)).toBeInTheDocument();
  });
});

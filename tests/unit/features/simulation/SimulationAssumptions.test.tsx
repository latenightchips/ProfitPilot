import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SimulationAssumptions } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Simulation Assumptions Panel — 06_TASKS.md M6-013 ("Implement
 * Simulation Assumptions Panel"). DoD: "Every simulation is fully
 * transparent." Every assertion below checks a value the real Service
 * actually computed (via the real Store actions), never a hand-crafted
 * mock result.
 */
const PORTFOLIO: ApplicationPortfolio = {
  collateral: { asset: 'BTC', quantity: 2 },
  debt: { asset: 'USDC', balance: 20000 },
  market: { btcPriceUsd: 50000 },
  protocol: {
    maxLoanToValue: 0.75,
    liquidationThreshold: 0.8,
    borrowApr: 0.05,
    supplyApr: 0.02,
  },
};

beforeEach(() => {
  useSimulationStore.getState().reset();
});

describe('SimulationAssumptions — empty state', () => {
  it('prompts the user to run a simulation, rather than rendering empty assumptions', () => {
    render(<SimulationAssumptions portfolio={PORTFOLIO} />);
    expect(screen.getByText('Run a simulation to see its assumptions.')).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — price scenario', () => {
  it('shows the real price assumption, protocol parameters, and formula version, with no Rate Assumptions row', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('Price Assumptions')).toBeInTheDocument();
    expect(screen.getByText('$60,000.00')).toBeInTheDocument();
    expect(screen.queryByText('Rate Assumptions')).not.toBeInTheDocument();

    expect(screen.getByText('Protocol Parameters')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Max LTV 75.00% · Liquidation Threshold 80.00% · Borrow APR 5.00% · Supply APR 2.00%',
      ),
    ).toBeInTheDocument();

    expect(screen.getByText('Fees & Slippage')).toBeInTheDocument();
    expect(
      screen.getByText(/no Formula ID or equation for swap fees or slippage exists/),
    ).toBeInTheDocument();

    expect(screen.getByText('Formula Version')).toBeInTheDocument();
    expect(screen.getByText(/Engine .+ · Formula/)).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — interest scenario', () => {
  it('shows both Price and Rate Assumptions, distinct from Protocol Parameters', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
      borrowApr: 0.1,
      timeHorizonDays: 100,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('+20.00%')).toBeInTheDocument();
    expect(screen.getByText('Rate Assumptions')).toBeInTheDocument();
    expect(screen.getByText('10.00% over 100 days')).toBeInTheDocument();
    // Protocol Parameters still shows the portfolio's own configured 5% —
    // distinct from the 10% simulated Rate Assumption above.
    expect(screen.getByText(/Borrow APR 5\.00%/)).toBeInTheDocument();
  });

  it('renders a negative percentage change without a leading "+" sign', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: -0.1 },
      borrowApr: 0.1,
      timeHorizonDays: 30,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('-10.00%')).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — Formula Version survives Load (Batch 18, M6-019 fix)', () => {
  it('still shows Formula Version after loading a saved scenario, not just a freshly-run one', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');

    useSimulationStore.getState().setCurrentScenario(null);
    useSimulationStore.getState().loadSavedScenario(id);

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);
    expect(screen.getByText('Formula Version')).toBeInTheDocument();
    expect(screen.getByText(/Engine .+ · Formula/)).toBeInTheDocument();
  });
});

describe('SimulationAssumptions — portfolio action', () => {
  it('shows the current market price, unmodified, with no Rate Assumptions row', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 0 });

    render(<SimulationAssumptions portfolio={PORTFOLIO} />);

    expect(screen.getByText('$50,000.00 (current, unmodified)')).toBeInTheDocument();
    expect(screen.queryByText('Rate Assumptions')).not.toBeInTheDocument();
  });
});

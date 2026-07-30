import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScenarioSummary } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Scenario Summary — 06_TASKS.md M6-009 ("Implement Scenario Summary").
 * DoD: "Summary displays only calculated Service results." Every
 * assertion below checks a number the real Service actually computed
 * (via the real Store actions), never a hand-crafted mock result.
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

describe('ScenarioSummary — empty state', () => {
  it('shows a placeholder when no result has been computed yet', () => {
    render(<ScenarioSummary />);
    expect(screen.getByText('Change a scenario input to see results here.')).toBeInTheDocument();
  });
});

describe('ScenarioSummary — price/interest scenario result', () => {
  it('renders every available comparison metric from the real currentResult', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);

    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Liquidation Distance')).toBeInTheDocument();
    expect(screen.getByText('Leverage')).toBeInTheDocument();
    expect(screen.getByText('Interest Cost')).toBeInTheDocument();
    expect(screen.getByText('Profit/Loss')).toBeInTheDocument();
    // Baseline equity $80,000 → scenario equity $100,000.
    expect(screen.getByText('Portfolio Value').nextElementSibling?.textContent).toBe(
      '$80,000.00 → $100,000.00',
    );
  });

  it('does not render a Debt row and documents why', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);

    expect(screen.queryByText('Debt')).not.toBeInTheDocument();
    expect(screen.getByText(/Debt is not shown for price\/interest scenarios/)).toBeInTheDocument();
  });
});

describe('ScenarioSummary — portfolio action result', () => {
  it('renders all 7 numeric metrics from the real portfolioActionPreview', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 10000 });

    render(<ScenarioSummary />);

    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Debt')).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Liquidation Price')).toBeInTheDocument();
    expect(screen.getByText('Leverage')).toBeInTheDocument();
    expect(screen.getByText('Interest Cost')).toBeInTheDocument();
    expect(screen.getByText('Profit/Loss')).toBeInTheDocument();
    // Net equity: ($100,000 collateral − $20,000 debt) → ($150,000 collateral − $30,000 debt).
    expect(screen.getByText('Portfolio Value').nextElementSibling?.textContent).toBe(
      '$80,000.00 → $120,000.00',
    );
    expect(screen.getByText('Debt').nextElementSibling?.textContent).toBe(
      '$20,000.00 → $30,000.00',
    );
  });

  it('shows an em dash for a zero-debt portfolio’s Liquidation Price instead of fabricating one', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(
        { ...PORTFOLIO, debt: { asset: 'USDC', balance: 0 } },
        { collateralDelta: 0, debtDelta: 0 },
      );

    render(<ScenarioSummary />);
    expect(screen.getByText('Liquidation Price').nextElementSibling?.textContent).toBe('— → —');
  });
});

describe('ScenarioSummary — both result kinds populated at once (real bug found during manual browser verification)', () => {
  it('renders both the Price/Interest Scenario and Portfolio Action sections when a user has touched both kinds of field', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 0 });

    render(<ScenarioSummary />);

    expect(screen.getByText('Price / Interest Scenario')).toBeInTheDocument();
    expect(screen.getByText('Portfolio Action')).toBeInTheDocument();
    // Both sections' own "Portfolio Value" rows are present and distinct.
    expect(screen.getAllByText('Portfolio Value')).toHaveLength(2);
  });
});

describe('ScenarioSummary — warnings', () => {
  it('renders no Warnings section when there are none', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);
    expect(screen.queryByText('Warnings')).not.toBeInTheDocument();
  });

  it('renders each captured warning message when present', () => {
    useSimulationStore.setState({
      currentResult: {
        baseline: {
          label: 'Current Portfolio',
          equity: 80000,
          profitOrLoss: 0,
          healthFactor: 4,
          liquidationDistance: 3,
          debtCost: 1000,
          leverage: 1.25,
        },
        scenario: {
          label: 'Simulated Scenario',
          equity: 100000,
          profitOrLoss: 20000,
          healthFactor: 5,
          liquidationDistance: 4,
          debtCost: 1000,
          leverage: 1.2,
        },
        comparison: {
          scenarioALabel: 'Current Portfolio',
          scenarioBLabel: 'Simulated Scenario',
          differences: [],
        },
        assumptions: { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 60000 } },
      },
      warnings: [{ code: 'TEST_WARNING', message: 'This is a test warning.' }],
    });

    render(<ScenarioSummary />);
    expect(screen.getByText('Warnings')).toBeInTheDocument();
    expect(screen.getByText('This is a test warning.')).toBeInTheDocument();
  });

  it('renders two warnings sharing the same code as two distinct rows (Batch 16 fix)', () => {
    useSimulationStore.setState({
      currentResult: {
        baseline: {
          label: 'Current Portfolio',
          equity: 80000,
          profitOrLoss: 0,
          healthFactor: 4,
          liquidationDistance: 3,
          debtCost: 1000,
          leverage: 1.25,
        },
        scenario: {
          label: 'Simulated Scenario',
          equity: -5000,
          profitOrLoss: -85000,
          healthFactor: -1,
          liquidationDistance: -2,
          debtCost: 1000,
          leverage: 1.2,
        },
        comparison: {
          scenarioALabel: 'Current Portfolio',
          scenarioBLabel: 'Simulated Scenario',
          differences: [],
        },
        assumptions: { type: 'price', priceScenario: { type: 'absolute', btcPriceUsd: 1 } },
      },
      warnings: [
        { code: 'NEGATIVE_EQUITY', message: 'Equity is negative under this scenario.' },
        { code: 'NEGATIVE_EQUITY', message: 'Equity is negative under this scenario, again.' },
      ],
    });

    render(<ScenarioSummary />);
    expect(screen.getByText('Equity is negative under this scenario.')).toBeInTheDocument();
    expect(screen.getByText('Equity is negative under this scenario, again.')).toBeInTheDocument();
  });
});

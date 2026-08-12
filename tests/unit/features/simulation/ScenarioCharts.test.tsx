import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScenarioCharts } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Scenario Charts — 06_TASKS.md M6-011 ("Implement Scenario Charts").
 * DoD: "Charts enhance understanding without replacing numerical data."
 * Requirements: "Accessible alternatives, Responsive." Every numeric
 * assertion below checks a value already sitting in a saved
 * `SimulationResult`, never freshly recalculated by this component.
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

function saveAPriceScenario(btcPriceUsd: number): string {
  useSimulationStore.getState().setCurrentScenario({
    type: 'price',
    priceScenario: { type: 'absolute', btcPriceUsd },
  });
  useSimulationStore.getState().runSimulation(PORTFOLIO);
  const id = useSimulationStore.getState().saveCurrentScenario({
    name: 'Test Scenario',
    portfolioId: 'portfolio-1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
  });
  if (id === null) throw new Error('setup failed');
  return id;
}

function saveAnInterestScenario(): string {
  useSimulationStore.getState().setCurrentScenario({
    type: 'interest',
    priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
    timeHorizonDays: 30,
    borrowApr: 0.05,
  });
  useSimulationStore.getState().runSimulation(PORTFOLIO);
  const id = useSimulationStore.getState().saveCurrentScenario({
    name: 'Test Scenario',
    portfolioId: 'portfolio-1',
    portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
  });
  if (id === null) throw new Error('setup failed');
  return id;
}

describe('ScenarioCharts — empty state', () => {
  it('prompts the user to select scenarios, rather than rendering empty charts', () => {
    render(<ScenarioCharts />);
    expect(
      screen.getByText('Select scenarios in Portfolio Comparison above to see charts.'),
    ).toBeInTheDocument();
  });
});

describe('ScenarioCharts — with selected scenarios', () => {
  it('renders all 3 chartable metrics with accessible role="img" summaries reflecting real saved values', async () => {
    const user = userEvent.setup();
    const id1 = saveAPriceScenario(60000);
    const id2 = saveAPriceScenario(70000);
    useSimulationStore.getState().toggleComparisonSelection(id1);
    useSimulationStore.getState().toggleComparisonSelection(id2);

    render(<ScenarioCharts />);

    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Interest Cost')).toBeInTheDocument();

    // 2 BTC * $60,000 − $20,000 = $100,000; 2 BTC * $70,000 − $20,000 = $120,000.
    const equityChart = screen.getByRole('img', { name: /Portfolio Value/ });
    expect(equityChart).toHaveAccessibleName(/\$100,000\.00/);
    expect(equityChart).toHaveAccessibleName(/\$120,000\.00/);

    await user.click(screen.getByText('Portfolio Value')); // sanity: no crash on interaction
  });

  it('documents the Debt/BTC exposure gaps instead of fabricating them', () => {
    const id = saveAPriceScenario(60000);
    useSimulationStore.getState().toggleComparisonSelection(id);

    render(<ScenarioCharts />);

    expect(screen.queryByText('Debt')).not.toBeInTheDocument();
    expect(screen.queryByText('BTC Exposure')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Debt and BTC exposure charts aren.t available for saved/),
    ).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('source comment');
  });

  it('labels an interest scenario’s own bar distinctly from a price scenario', () => {
    const id = saveAnInterestScenario();
    useSimulationStore.getState().toggleComparisonSelection(id);

    render(<ScenarioCharts />);

    const equityChart = screen.getByRole('img', { name: /Portfolio Value/ });
    expect(equityChart).toHaveAccessibleName(/Interest Scenario 1/);
  });
});

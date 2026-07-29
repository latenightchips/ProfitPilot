import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScenarioComparison } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Scenario Comparison — 06_TASKS.md M6-010 ("Implement Scenario
 * Comparison"). DoD: "Users can compare scenarios without recalculation
 * inside the UI." Every numeric assertion below checks a value already
 * sitting in a saved `SimulationResult` (produced once, via the real
 * Store actions), never freshly recalculated by this component.
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

function saveAPriceScenario(btcPriceUsd: number, name = 'Test Scenario'): string {
  useSimulationStore.getState().setCurrentScenario({
    type: 'price',
    priceScenario: { type: 'absolute', btcPriceUsd },
  });
  useSimulationStore.getState().runSimulation(PORTFOLIO);
  const id = useSimulationStore
    .getState()
    .saveCurrentScenario({ name, portfolioId: 'portfolio-1' });
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
  const id = useSimulationStore
    .getState()
    .saveCurrentScenario({ name: 'Test Scenario', portfolioId: 'portfolio-1' });
  if (id === null) throw new Error('setup failed');
  return id;
}

function rowValues(label: string): string[] {
  const row = screen.getByText(label).closest('tr');
  if (row === null) throw new Error(`row not found for ${label}`);
  return Array.from(row.querySelectorAll('td'))
    .slice(1)
    .map((cell) => cell.textContent ?? '');
}

describe('ScenarioComparison — empty state', () => {
  it('explains that nothing is saved yet, rather than showing a blank comparison', () => {
    render(<ScenarioComparison />);
    expect(screen.getByText('No scenarios saved yet.')).toBeInTheDocument();
  });
});

describe('ScenarioComparison — with saved scenarios, none selected', () => {
  it('lists every saved scenario as an unchecked, selectable option', () => {
    saveAPriceScenario(60000);
    render(<ScenarioComparison />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/Test Scenario \(Price Scenario\)/)).toBeInTheDocument();
    expect(
      screen.getByText('Select scenarios above to compare them side-by-side.'),
    ).toBeInTheDocument();
  });

  it('labels a saved interest scenario distinctly from a price scenario', () => {
    saveAnInterestScenario();
    render(<ScenarioComparison />);
    expect(screen.getByText(/Interest Scenario/)).toBeInTheDocument();
  });
});

describe('ScenarioComparison — selecting scenarios renders a real comparison table', () => {
  it('renders each selected scenario’s own already-saved metrics, unchanged by selection order', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    saveAPriceScenario(70000, 'Bull Case Plus');

    render(<ScenarioComparison />);
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // 2 BTC * $60,000 − $20,000 = $100,000; 2 BTC * $70,000 − $20,000 = $120,000.
    expect(rowValues('Equity')).toEqual(['$100,000.00', '$120,000.00']);
    expect(screen.getByRole('columnheader', { name: 'Bull Case' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Bull Case Plus' })).toBeInTheDocument();
    expect(screen.getByText('Health Factor')).toBeInTheDocument();
    expect(screen.getByText('Interest')).toBeInTheDocument();
    expect(screen.getByText('Leverage')).toBeInTheDocument();
    expect(screen.getByText('Liquidation Distance')).toBeInTheDocument();
  });

  it('removes a scenario from the table when its checkbox is unchecked', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000);

    render(<ScenarioComparison />);
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(rowValues('Equity')).toEqual(['$100,000.00']);

    await user.click(checkbox);
    expect(
      screen.getByText('Select scenarios above to compare them side-by-side.'),
    ).toBeInTheDocument();
  });

  it('documents the Debt/Liquidation Price/Risk gaps instead of fabricating them', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000);

    render(<ScenarioComparison />);
    await user.click(screen.getByRole('checkbox'));

    expect(screen.queryByText('Debt')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk')).not.toBeInTheDocument();
    expect(screen.getByText(/Debt and Liquidation Price are not shown/)).toBeInTheDocument();
    expect(screen.getByText(/Risk is blocked by Conflict #1/)).toBeInTheDocument();
  });
});

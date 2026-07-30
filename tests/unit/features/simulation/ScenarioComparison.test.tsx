import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScenarioComparison } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Scenario Comparison — 06_TASKS.md M6-010 ("Implement Scenario
 * Comparison") + M6-016 ("Load Saved Simulation", Batch 15). DoD:
 * "Users can compare scenarios without recalculation inside the UI";
 * "Historical simulations remain reproducible." Every numeric assertion
 * below checks a value already sitting in a saved `SimulationResult`
 * (produced once, via the real Store actions), never freshly
 * recalculated by this component.
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

const PORTFOLIO_UPDATED_AT = '2026-01-01T00:00:00.000Z';

function testPortfolio(overrides: Partial<Portfolio> = {}): Portfolio {
  return {
    id: 'portfolio-1',
    name: 'Test Portfolio',
    baseCurrency: 'USD',
    collateral: PORTFOLIO.collateral,
    debt: { asset: 'USDC', balance: PORTFOLIO.debt.balance },
    market: PORTFOLIO.market,
    protocol: PORTFOLIO.protocol,
    settings: {},
    archivedAt: null,
    marketUpdatedAt: PORTFOLIO_UPDATED_AT,
    protocolUpdatedAt: PORTFOLIO_UPDATED_AT,
    createdAt: PORTFOLIO_UPDATED_AT,
    updatedAt: PORTFOLIO_UPDATED_AT,
    ...overrides,
  };
}

beforeEach(() => {
  useSimulationStore.getState().reset();
});

function saveAPriceScenario(btcPriceUsd: number, name = 'Test Scenario'): string {
  useSimulationStore.getState().setCurrentScenario({
    type: 'price',
    priceScenario: { type: 'absolute', btcPriceUsd },
  });
  useSimulationStore.getState().runSimulation(PORTFOLIO);
  const id = useSimulationStore.getState().saveCurrentScenario({
    name,
    portfolioId: 'portfolio-1',
    portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
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
    portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
  });
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
    render(<ScenarioComparison portfolio={testPortfolio()} />);
    expect(screen.getByText('No scenarios saved yet.')).toBeInTheDocument();
  });
});

describe('ScenarioComparison — with saved scenarios, none selected', () => {
  it('lists every saved scenario as an unchecked, selectable option', () => {
    saveAPriceScenario(60000);
    render(<ScenarioComparison portfolio={testPortfolio()} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/Test Scenario \(Price Scenario\)/)).toBeInTheDocument();
    expect(
      screen.getByText('Select scenarios above to compare them side-by-side.'),
    ).toBeInTheDocument();
  });

  it('labels a saved interest scenario distinctly from a price scenario', () => {
    saveAnInterestScenario();
    render(<ScenarioComparison portfolio={testPortfolio()} />);
    expect(screen.getByText(/Interest Scenario/)).toBeInTheDocument();
  });
});

describe('ScenarioComparison — selecting scenarios renders a real comparison table', () => {
  it('renders each selected scenario’s own already-saved metrics, unchanged by selection order', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    saveAPriceScenario(70000, 'Bull Case Plus');

    render(<ScenarioComparison portfolio={testPortfolio()} />);
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

    render(<ScenarioComparison portfolio={testPortfolio()} />);
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

    render(<ScenarioComparison portfolio={testPortfolio()} />);
    await user.click(screen.getByRole('checkbox'));

    expect(screen.queryByText('Debt')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk')).not.toBeInTheDocument();
    expect(screen.getByText(/Debt and Liquidation Price are not shown/)).toBeInTheDocument();
    expect(screen.getByText(/Risk is blocked by Conflict #1/)).toBeInTheDocument();
  });
});

describe('ScenarioComparison — Load (M6-016, Batch 15)', () => {
  it('restores the saved scenario as currentScenario/currentResult on Load', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    useSimulationStore.getState().setCurrentScenario(null);

    render(<ScenarioComparison portfolio={testPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Load' }));

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    expect(state.currentResult?.scenario.equity).toBe(100000);
  });

  it('shows no drift notice when the portfolio has not changed since saving', () => {
    saveAPriceScenario(60000);
    render(<ScenarioComparison portfolio={testPortfolio()} />);
    expect(screen.queryByText(/Portfolio has changed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved against a different portfolio/)).not.toBeInTheDocument();
  });

  it('shows a drift notice when the same portfolio has changed since saving', () => {
    saveAPriceScenario(60000);
    render(
      <ScenarioComparison portfolio={testPortfolio({ updatedAt: '2026-06-01T00:00:00.000Z' })} />,
    );
    expect(screen.getByText(/Portfolio has changed since this was saved\./)).toBeInTheDocument();
  });

  it('shows a distinct notice when the scenario was saved against a different portfolio', () => {
    saveAPriceScenario(60000);
    render(<ScenarioComparison portfolio={testPortfolio({ id: 'portfolio-2' })} />);
    expect(screen.getByText(/Saved against a different portfolio\./)).toBeInTheDocument();
  });
});

describe('ScenarioComparison — Duplicate (M6-017, Batch 16)', () => {
  it('adds an independent copy with an appended name as its own new row', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(screen.getByText(/Bull Case \(Price Scenario\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bull Case \(Copy\) \(Price Scenario\)/)).toBeInTheDocument();
    expect(useSimulationStore.getState().savedScenarios).toHaveLength(2);
  });

  it('leaves the original selectable/loadable after the duplicate is deleted', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    const state = useSimulationStore.getState();
    const copy = state.savedScenarios.find((saved) => saved.name === 'Bull Case (Copy)');
    if (copy === undefined) throw new Error('copy not found');

    useSimulationStore.getState().deleteSavedScenario(copy.id);

    expect(useSimulationStore.getState().savedScenarios).toHaveLength(1);
    expect(useSimulationStore.getState().savedScenarios[0].name).toBe('Bull Case');
  });
});

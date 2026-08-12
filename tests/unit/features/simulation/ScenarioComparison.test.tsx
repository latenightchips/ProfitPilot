import { render, screen, within } from '@testing-library/react';
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
const PORTFOLIO_NAMES: Record<string, string> = { 'portfolio-1': 'Test Portfolio' };

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
    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    expect(screen.getByText('No scenarios saved yet.')).toBeInTheDocument();
  });
});

describe('ScenarioComparison — with saved scenarios, none selected', () => {
  it('lists every saved scenario as an unchecked, selectable option', () => {
    saveAPriceScenario(60000);
    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/Test Scenario \(Price Scenario\)/)).toBeInTheDocument();
    expect(
      screen.getByText('Select scenarios above to compare them side-by-side.'),
    ).toBeInTheDocument();
  });

  it('labels a saved interest scenario distinctly from a price scenario', () => {
    saveAnInterestScenario();
    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    expect(screen.getByText(/Interest Scenario/)).toBeInTheDocument();
  });
});

describe('ScenarioComparison — selecting scenarios renders a real comparison table', () => {
  it('renders each selected scenario’s own already-saved metrics, unchanged by selection order', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    saveAPriceScenario(70000, 'Bull Case Plus');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
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

  it('marks every column header with scope="col" (Batch 21, M6-022 accessibility fix)', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    saveAPriceScenario(70000, 'Bull Case Plus');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).toHaveAttribute('scope', 'col');
    }
  });

  it('removes a scenario from the table when its checkbox is unchecked', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000);

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
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

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('checkbox'));

    expect(screen.queryByText('Debt')).not.toBeInTheDocument();
    expect(screen.queryByText('Risk')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Debt and Liquidation Price aren.t available for saved scenarios/),
    ).toBeInTheDocument();
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toMatch(/Conflict #\d+/);
    expect(bodyText).not.toContain('source comment');
  });
});

describe('ScenarioComparison — Load (M6-016, Batch 15)', () => {
  it('restores the saved scenario as currentScenario/currentResult on Load', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    useSimulationStore.getState().setCurrentScenario(null);

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
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
    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    expect(screen.queryByText(/Portfolio has changed/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Saved against a different portfolio/)).not.toBeInTheDocument();
  });

  it('shows a drift notice when the same portfolio has changed since saving', () => {
    saveAPriceScenario(60000);
    render(
      <ScenarioComparison
        portfolio={testPortfolio({ updatedAt: '2026-06-01T00:00:00.000Z' })}
        portfolioNames={PORTFOLIO_NAMES}
      />,
    );
    expect(screen.getByText(/Portfolio has changed since this was saved\./)).toBeInTheDocument();
  });

  it('shows a distinct notice when the scenario was saved against a different portfolio', () => {
    saveAPriceScenario(60000);
    render(
      <ScenarioComparison
        portfolio={testPortfolio({ id: 'portfolio-2' })}
        portfolioNames={PORTFOLIO_NAMES}
      />,
    );
    expect(screen.getByText(/Saved against a different portfolio\./)).toBeInTheDocument();
  });
});

describe('ScenarioComparison — Duplicate (M6-017, Batch 16)', () => {
  it('adds an independent copy with an appended name as its own new row', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    expect(screen.getByText(/Bull Case \(Price Scenario\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bull Case \(Copy\) \(Price Scenario\)/)).toBeInTheDocument();
    expect(useSimulationStore.getState().savedScenarios).toHaveLength(2);
  });

  it('leaves the original selectable/loadable after the duplicate is deleted', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('button', { name: 'Duplicate' }));

    const state = useSimulationStore.getState();
    const copy = state.savedScenarios.find((saved) => saved.name === 'Bull Case (Copy)');
    if (copy === undefined) throw new Error('copy not found');

    useSimulationStore.getState().deleteSavedScenario(copy.id);

    expect(useSimulationStore.getState().savedScenarios).toHaveLength(1);
    expect(useSimulationStore.getState().savedScenarios[0].name).toBe('Bull Case');
  });
});

describe('ScenarioComparison — Delete (M6-018, Batch 17)', () => {
  it('does not delete on a bare click — only opens an inline confirmation', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    expect(useSimulationStore.getState().savedScenarios).toHaveLength(1);
    expect(screen.getByText('Delete “Bull Case”?')).toBeInTheDocument();
    expect(
      screen.getByText('This permanently removes this saved simulation. This cannot be undone.'),
    ).toBeInTheDocument();
  });

  it('deletes only after Confirm Delete is clicked', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
    expect(screen.getByText('No scenarios saved yet.')).toBeInTheDocument();
  });

  it('deletes nothing when Cancel is clicked', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(useSimulationStore.getState().savedScenarios).toHaveLength(1);
    expect(screen.queryByText('Delete “Bull Case”?')).not.toBeInTheDocument();
  });

  it('confirming delete on one row does not affect an unrelated saved scenario', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');
    saveAPriceScenario(70000, 'Bear Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    const bullCaseRow = screen
      .getByText(/Bull Case \(Price Scenario\)/)
      .closest('div.flex.flex-col');
    if (bullCaseRow === null) throw new Error('row not found');
    const { getByRole } = within(bullCaseRow as HTMLElement);
    await user.click(getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    const remaining = useSimulationStore.getState().savedScenarios;
    expect(remaining).toHaveLength(1);
    expect(remaining[0].name).toBe('Bear Case');
  });

  it('removes a deleted scenario from the comparison selection', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Bull Case');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.click(screen.getByRole('checkbox'));
    expect(rowValues('Equity')).toEqual(['$100,000.00']);

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Confirm Delete' }));

    expect(useSimulationStore.getState().comparisonSelection).toEqual([]);
  });
});

describe('ScenarioComparison — Sorting (M6-020, Batch 19)', () => {
  function rowLabels(): string[] {
    return screen
      .getAllByRole('checkbox')
      .map((checkbox) => checkbox.closest('label')?.textContent ?? '');
  }

  it('defaults to Date, newest-first', () => {
    saveAPriceScenario(60000, 'First Saved');
    saveAPriceScenario(70000, 'Second Saved');
    useSimulationStore.setState((state) => ({
      savedScenarios: state.savedScenarios.map((saved) => ({
        ...saved,
        createdAt:
          saved.name === 'First Saved' ? '2026-01-01T00:00:00.000Z' : '2026-02-01T00:00:00.000Z',
      })),
    }));

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);

    expect(screen.getByRole('combobox', { name: 'Sort by' })).toHaveValue('date');
    const labels = rowLabels();
    expect(labels[0]).toContain('Second Saved');
    expect(labels[1]).toContain('First Saved');
  });

  it('sorts alphabetically by scenario name when Scenario name is selected', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'Zebra');
    saveAPriceScenario(70000, 'Alpha');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={PORTFOLIO_NAMES} />);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Scenario name');

    const labels = rowLabels();
    expect(labels[0]).toContain('Alpha');
    expect(labels[1]).toContain('Zebra');
  });

  it('sorts alphabetically by resolved portfolio name when Portfolio is selected', async () => {
    const user = userEvent.setup();
    saveAPriceScenario(60000, 'From Zed Portfolio');
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 70000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    useSimulationStore.getState().saveCurrentScenario({
      name: 'From Alpha Portfolio',
      portfolioId: 'portfolio-2',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });

    render(
      <ScenarioComparison
        portfolio={testPortfolio()}
        portfolioNames={{ 'portfolio-1': 'Zed Portfolio', 'portfolio-2': 'Alpha Portfolio' }}
      />,
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'Portfolio');

    const labels = rowLabels();
    expect(labels[0]).toContain('From Alpha Portfolio');
    expect(labels[1]).toContain('From Zed Portfolio');
  });

  it('displays "(Unknown Portfolio)" for a saved scenario whose portfolio no longer exists', () => {
    saveAPriceScenario(60000, 'Orphaned Scenario');

    render(<ScenarioComparison portfolio={testPortfolio()} portfolioNames={{}} />);

    expect(screen.getByText(/\(Unknown Portfolio\)/)).toBeInTheDocument();
  });
});

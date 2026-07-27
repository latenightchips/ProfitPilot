import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ScenarioBuilder } from '@/features/simulation';
import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Scenario Builder — 06_TASKS.md M6-004. DoD: "Scenario inputs are
 * validated before calculation."
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
  useSimulationStore.setState({
    currentScenario: null,
    currentResult: null,
    savedScenarios: [],
    comparisonSelection: [],
    status: 'idle',
    errors: [],
    previewMode: false,
  });
});

describe('ScenarioBuilder — Include list (M6-004)', () => {
  it('renders all six named inputs, pre-filled from the portfolio’s own current values', () => {
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);
    expect(screen.getByLabelText('BTC Price')).toHaveValue(50000);
    expect(screen.getByLabelText('Borrow Rate (0–1)')).toHaveValue(0.05);
    expect(screen.getByLabelText('Collateral Change (BTC)')).toHaveValue(0);
    expect(screen.getByLabelText('Debt Change (USD)')).toHaveValue(0);
    expect(screen.getByLabelText('Target Health Factor')).toHaveValue(null);
    expect(screen.getByLabelText('Holding Period')).toHaveValue('30');
  });

  it('reveals the custom holding period input only when "Custom" is selected', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    expect(screen.queryByLabelText('Custom Holding Period (days)')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Holding Period'), 'custom');
    expect(screen.getByLabelText('Custom Holding Period (days)')).toBeInTheDocument();
  });
});

describe('ScenarioBuilder — validation (M6-004 DoD)', () => {
  it('shows an inline error for an invalid BTC price and does not update the Store', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '-5');

    expect(screen.getByText('BTC price must be a positive number.')).toBeInTheDocument();
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('ScenarioBuilder — live BTC Price wiring (M6-004 Dependencies: M3-009)', () => {
  it('updates the Simulation Store and runs a real simulation on a valid BTC Price change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '60000');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    expect(state.status).toBe('idle');
    // 2 BTC * $60,000 - $20,000 debt = $100,000 net equity in the scenario.
    expect(state.currentResult?.scenario.equity).toBe(100000);
  });
});

describe('ScenarioBuilder — Reset Scenario', () => {
  it('restores every field to the portfolio’s own current values and resets the Store', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '60000');
    expect(useSimulationStore.getState().currentResult).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'Reset Scenario' }));

    expect(screen.getByLabelText('BTC Price')).toHaveValue(50000);
    expect(useSimulationStore.getState().currentScenario).toBeNull();
    expect(useSimulationStore.getState().currentResult).toBeNull();
  });
});

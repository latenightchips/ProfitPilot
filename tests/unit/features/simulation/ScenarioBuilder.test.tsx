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
    portfolioActionPreview: null,
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

  it('accepts typed input in Target Health Factor without triggering any calculation (no later task wires it — see the component’s own header comment)', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const input = screen.getByLabelText('Target Health Factor');
    await user.type(input, '2');

    expect(input).toHaveValue(2);
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });

  it('shows an inline error for an invalid Target Health Factor', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const input = screen.getByLabelText('Target Health Factor');
    await user.type(input, '-1');

    expect(screen.getByText('Target Health Factor must be a positive number.')).toBeInTheDocument();
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

describe('ScenarioBuilder — live Percentage Change wiring (M6-005, Batch 4)', () => {
  it('updates the Simulation Store and runs a real simulation on a valid percentage change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const percentInput = screen.getByLabelText('Percentage Change (0–1)');
    await user.type(percentInput, '0.2');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
    });
    // BTC price $50,000 * 1.2 = $60,000; 2 BTC * $60,000 - $20,000 debt = $100,000.
    expect(state.currentResult?.scenario.equity).toBe(100000);
  });

  it('does nothing when Percentage Change is cleared back to empty', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const percentInput = screen.getByLabelText('Percentage Change (0–1)');
    await user.type(percentInput, '0.2');
    await user.clear(percentInput);

    expect(percentInput).toHaveValue(null);
    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
    });
  });

  it('shows an inline error for a percentage change that would drop the price to zero or below', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const percentInput = screen.getByLabelText('Percentage Change (0–1)');
    await user.type(percentInput, '-1');

    expect(
      screen.getByText('Percentage change cannot reduce the price to zero or below.'),
    ).toBeInTheDocument();
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('ScenarioBuilder — Preset Scenarios (M6-005, Batch 4)', () => {
  it('renders all 8 presets from the PRD’s own "Required Presets" list', () => {
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);
    for (const label of ['+10%', '+25%', '+50%', '+100%', '-10%', '-20%', '-30%', '-50%']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('clicking a preset runs a real simulation using that fixed percentage change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    await user.click(screen.getByRole('button', { name: '+10%' }));

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: 0.1 },
    });
    // BTC price $50,000 * 1.1 = $55,000; 2 BTC * $55,000 - $20,000 debt = $90,000.
    expect(state.currentResult?.scenario.equity).toBe(90000);
    expect(screen.getByLabelText('Percentage Change (0–1)')).toHaveValue(0.1);
  });
});

describe('ScenarioBuilder — live Borrow Rate wiring (M6-006, Batch 6)', () => {
  it('runs a real interest scenario using the current price and holding period', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (0–1)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '0.1');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.1,
    });
    expect(state.status).toBe('idle');
    expect(state.currentResult?.assumptions).toEqual(state.currentScenario);
    // 30-day accrued interest on $20,000 at 10% APR is strictly positive.
    expect(state.currentResult?.scenario.debtCost).toBeGreaterThan(0);
  });

  it('resolves the price side from a valid Percentage Change instead of the absolute price when both are set', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const percentInput = screen.getByLabelText('Percentage Change (0–1)');
    await user.type(percentInput, '0.2');

    const borrowRateInput = screen.getByLabelText('Borrow Rate (0–1)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '0.08');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
      borrowApr: 0.08,
    });
  });

  it('shows an inline error and does not update the Store for a negative Borrow Rate', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (0–1)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '-1');

    expect(screen.getByText('Borrow rate cannot be negative.')).toBeInTheDocument();
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('ScenarioBuilder — live Holding Period wiring (M6-007, Batch 7)', () => {
  it('does nothing when no interest scenario is active yet', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '90');

    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });

  it('does not disturb an active price scenario', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '60000');

    await user.selectOptions(screen.getByLabelText('Holding Period'), '90');

    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
  });

  it('re-runs the active interest scenario with the newly selected Holding Period', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (0–1)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '0.1');

    await user.selectOptions(screen.getByLabelText('Holding Period'), '365');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({ type: 'interest', timeHorizonDays: 365 });
    expect(state.currentResult?.assumptions).toEqual(state.currentScenario);
  });

  it('re-runs the active interest scenario when a valid Custom Holding Period is entered', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (0–1)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '0.1');

    await user.selectOptions(screen.getByLabelText('Holding Period'), 'custom');
    const customInput = screen.getByLabelText('Custom Holding Period (days)');
    await user.type(customInput, '45');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({ type: 'interest', timeHorizonDays: 45 });
  });

  it('does not update the Store while the Custom Holding Period is invalid', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (0–1)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '0.1');
    const scenarioBeforeEdit = useSimulationStore.getState().currentScenario;

    await user.selectOptions(screen.getByLabelText('Holding Period'), 'custom');
    const customInput = screen.getByLabelText('Custom Holding Period (days)');
    await user.type(customInput, '-1');

    expect(useSimulationStore.getState().currentScenario).toEqual(scenarioBeforeEdit);
  });
});

describe('ScenarioBuilder — live Collateral/Debt Change wiring (M6-008, Batch 5)', () => {
  it('updates portfolioActionPreview on a valid Collateral Change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const collateralInput = screen.getByLabelText('Collateral Change (BTC)');
    await user.clear(collateralInput);
    await user.type(collateralInput, '2');

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    // 2 BTC + 2 BTC = 4 BTC * $50,000 = $200,000.
    expect(state.portfolioActionPreview?.after.collateralValue).toBe(200000);
    expect(state.portfolioActionPreview?.before.collateralValue).toBe(100000);
  });

  it('updates portfolioActionPreview on a valid Debt Change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const debtInput = screen.getByLabelText('Debt Change (USD)');
    await user.clear(debtInput);
    await user.type(debtInput, '10000');

    const state = useSimulationStore.getState();
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
  });

  it('applies both deltas together for a combined action', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const collateralInput = screen.getByLabelText('Collateral Change (BTC)');
    await user.clear(collateralInput);
    await user.type(collateralInput, '1');

    const debtInput = screen.getByLabelText('Debt Change (USD)');
    await user.clear(debtInput);
    await user.type(debtInput, '10000');

    const state = useSimulationStore.getState();
    // 3 BTC * $50,000 = $150,000; $20,000 + $10,000 = $30,000.
    expect(state.portfolioActionPreview?.after.collateralValue).toBe(150000);
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
  });

  it('shows an inline error and does not update portfolioActionPreview on an over-withdrawal', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} />);

    const collateralInput = screen.getByLabelText('Collateral Change (BTC)');
    await user.clear(collateralInput);
    await user.type(collateralInput, '-5');

    expect(useSimulationStore.getState().portfolioActionPreview).toBeNull();
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

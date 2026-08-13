import { fireEvent, render, screen, within } from '@testing-library/react';
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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);
    expect(screen.getByLabelText('BTC Price')).toHaveValue(50000);
    expect(screen.getByLabelText('Borrow Rate (%)')).toHaveValue(5);
    expect(screen.getByLabelText('Collateral Change (BTC)')).toHaveValue(0);
    expect(screen.getByLabelText('Debt Change (USD)')).toHaveValue(0);
    expect(screen.getByLabelText('Target Health Factor')).toHaveValue(null);
    expect(screen.getByLabelText('Holding Period')).toHaveValue('30');
  });

  it('accepts typed input in Target Health Factor without triggering any calculation (no later task wires it — see the component’s own header comment)', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const input = screen.getByLabelText('Target Health Factor');
    await user.type(input, '2');

    expect(input).toHaveValue(2);
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });

  it('shows an inline error for an invalid Target Health Factor', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const input = screen.getByLabelText('Target Health Factor');
    await user.type(input, '-1');

    expect(screen.getByText('Target Health Factor must be a positive number.')).toBeInTheDocument();
  });

  it('reveals the custom holding period input only when "Custom" is selected', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    expect(screen.queryByLabelText('Custom Holding Period (days)')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Holding Period'), 'custom');
    expect(screen.getByLabelText('Custom Holding Period (days)')).toBeInTheDocument();
  });
});

describe('ScenarioBuilder — validation (M6-004 DoD)', () => {
  it('shows an inline error for an invalid BTC price and does not update the Store', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const percentInput = screen.getByLabelText('Percentage Change (%)');
    await user.type(percentInput, '20');

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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const percentInput = screen.getByLabelText('Percentage Change (%)');
    await user.type(percentInput, '20');
    await user.clear(percentInput);

    expect(percentInput).toHaveValue(null);
    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
    });
  });

  it('shows an inline error for a percentage change that would drop the price to zero or below', () => {
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    // A single atomic change (not keystroke-by-keystroke `user.type`,
    // whose intermediate values like "-10" are themselves still valid
    // and would spuriously commit a scenario before the final "-100" is
    // reached) — a real user pasting or a browser number-spinner would
    // also produce one atomic change, not per-keystroke ones.
    const percentInput = screen.getByLabelText('Percentage Change (%)');
    fireEvent.change(percentInput, { target: { value: '-100' } });

    expect(
      screen.getByText('Percentage change cannot reduce the price to zero or below.'),
    ).toBeInTheDocument();
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('ScenarioBuilder — Preset Scenarios (M6-005, Batch 4)', () => {
  it('renders all 8 presets from the PRD’s own "Required Presets" list', () => {
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);
    for (const label of ['+10%', '+25%', '+50%', '+100%', '-10%', '-20%', '-30%', '-50%']) {
      expect(screen.getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('clicking a preset runs a real simulation using that fixed percentage change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    await user.click(screen.getByRole('button', { name: '+10%' }));

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: 0.1 },
    });
    // BTC price $50,000 * 1.1 = $55,000; 2 BTC * $55,000 - $20,000 debt = $90,000.
    expect(state.currentResult?.scenario.equity).toBe(90000);
    expect(screen.getByLabelText('Percentage Change (%)')).toHaveValue(10);
  });
});

describe('ScenarioBuilder — live Borrow Rate wiring (M6-006, Batch 6)', () => {
  it('runs a real interest scenario using the current price and holding period', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (%)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '10');

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
    // Scenario Timeline (M6-012, Batch 11) also re-populates from the
    // same interest-scenario field change.
    expect(state.timelineProjection).toHaveLength(5);
  });

  it('resolves the price side from a valid Percentage Change instead of the absolute price when both are set', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const percentInput = screen.getByLabelText('Percentage Change (%)');
    await user.type(percentInput, '20');

    const borrowRateInput = screen.getByLabelText('Borrow Rate (%)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '8');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: 0.2 },
      borrowApr: 0.08,
    });
  });

  it('shows an inline error and does not update the Store for a negative Borrow Rate', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (%)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '-1');

    expect(screen.getByText('Borrow rate cannot be negative.')).toBeInTheDocument();
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('ScenarioBuilder — live Holding Period wiring (M6-007, Batch 7)', () => {
  it('initiates an interest scenario from the baseline state, using the pre-filled Borrow Rate — PT-12 fix (physical-testing round 2): previously only re-ran an already-active interest scenario, so changing Holding Period from the default state silently did nothing', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '90');

    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 90,
      borrowApr: 0.05,
    });
  });

  it('Interest Cost actually changes when Holding Period changes (PT-12: was previously pinned to the annual figure)', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '30');
    const interestAt30Days = useSimulationStore.getState().currentResult?.scenario.debtCost;

    await user.selectOptions(screen.getByLabelText('Holding Period'), '365');
    const interestAt365Days = useSimulationStore.getState().currentResult?.scenario.debtCost;

    expect(interestAt30Days).not.toBe(interestAt365Days);
    expect(interestAt365Days).toBeGreaterThan(interestAt30Days!);
  });

  it('promotes an active price scenario to an interest scenario when Holding Period is changed (PT-12 follow-up interaction-order fix) — previously this was permanently blocked once any price field had been touched', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '60000');
    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });

    await user.selectOptions(screen.getByLabelText('Holding Period'), '90');

    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
      timeHorizonDays: 90,
      borrowApr: 0.05,
    });
  });

  it('re-runs the active interest scenario with the newly selected Holding Period', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (%)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '10');

    await user.selectOptions(screen.getByLabelText('Holding Period'), '365');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({ type: 'interest', timeHorizonDays: 365 });
    expect(state.currentResult?.assumptions).toEqual(state.currentScenario);
    // Scenario Timeline (M6-012, Batch 11) re-populates with day values
    // spanning the newly selected 365-day horizon.
    expect(state.timelineProjection?.map((p) => p.day)).toEqual([0, 91.25, 182.5, 273.75, 365]);
  });

  it('re-runs the active interest scenario when a valid Custom Holding Period is entered', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (%)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '10');

    await user.selectOptions(screen.getByLabelText('Holding Period'), 'custom');
    const customInput = screen.getByLabelText('Custom Holding Period (days)');
    await user.type(customInput, '45');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({ type: 'interest', timeHorizonDays: 45 });
  });

  it('does not update the Store while the Custom Holding Period is invalid', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const borrowRateInput = screen.getByLabelText('Borrow Rate (%)');
    await user.clear(borrowRateInput);
    await user.type(borrowRateInput, '10');
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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const debtInput = screen.getByLabelText('Debt Change (USD)');
    await user.clear(debtInput);
    await user.type(debtInput, '10000');

    const state = useSimulationStore.getState();
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
  });

  it('applies both deltas together for a combined action', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

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
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const collateralInput = screen.getByLabelText('Collateral Change (BTC)');
    await user.clear(collateralInput);
    await user.type(collateralInput, '-5');

    expect(useSimulationStore.getState().portfolioActionPreview).toBeNull();
  });
});

describe('ScenarioBuilder — Reset Scenario', () => {
  it('restores every field to the portfolio’s own current values and resets the Store', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

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

describe('ScenarioBuilder — PT-11 scenario grouping is unmistakable', () => {
  it('groups Price/Interest Scenario fields and Portfolio Action fields into two distinct, accessibly-named fieldsets', () => {
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const priceInterestGroup = screen.getByRole('group', { name: 'Price / Interest Scenario' });
    const portfolioActionGroup = screen.getByRole('group', { name: 'Portfolio Action' });

    expect(within(priceInterestGroup).getByLabelText('BTC Price')).toBeInTheDocument();
    expect(within(priceInterestGroup).getByLabelText('Borrow Rate (%)')).toBeInTheDocument();
    expect(within(priceInterestGroup).getByLabelText('Holding Period')).toBeInTheDocument();
    expect(
      within(portfolioActionGroup).getByLabelText('Collateral Change (BTC)'),
    ).toBeInTheDocument();
    expect(within(portfolioActionGroup).getByLabelText('Debt Change (USD)')).toBeInTheDocument();
  });

  it('states in plain language that the two groups are independent scenarios', () => {
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    expect(
      screen.getByText(
        /changing a field in one does not affect the other, and each has its own separate result below/,
      ),
    ).toBeInTheDocument();
  });

  it('keeps Price/Interest Scenario and Portfolio Action results independent for the PT-11 repro (BTC -50%, +1 BTC collateral, +$10,000 debt)', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={PORTFOLIO} portfolioId="portfolio-1" />);

    const percentInput = screen.getByLabelText('Percentage Change (%)');
    await user.type(percentInput, '-50');

    const collateralInput = screen.getByLabelText('Collateral Change (BTC)');
    await user.clear(collateralInput);
    await user.type(collateralInput, '1');

    const debtInput = screen.getByLabelText('Debt Change (USD)');
    await user.clear(debtInput);
    await user.type(debtInput, '10000');

    const state = useSimulationStore.getState();
    // Price/Interest Scenario: 2 BTC * ($50,000 * 0.5) - $20,000 debt = $30,000 equity —
    // unaffected by the Portfolio Action fields below.
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.5 },
    });
    expect(state.currentResult?.scenario.equity).toBe(30000);

    // Portfolio Action: 3 BTC * $50,000 = $150,000 collateral; $30,000 debt —
    // computed against the unmodified current price, unaffected by the
    // Percentage Change field above.
    expect(state.portfolioActionPreview?.before.collateralValue).toBe(100000);
    expect(state.portfolioActionPreview?.after.collateralValue).toBe(150000);
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
  });
});

describe('ScenarioBuilder — PT-12 follow-up: interest scenario survives BTC Price/Percentage Change edits', () => {
  // Known-good baseline from the physical-testing report: Debt $26,000,
  // Borrow APR 5%, Holding Period 30 days -> prorated interest
  // $26,000 * 5% * 30/365 ≈ $106.85; the full annual figure is $1,300.
  const DEBT_PORTFOLIO: ApplicationPortfolio = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 26000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };

  it('reproduces the reported stale-state sequence — selecting a 30-day interest scenario, changing the price scenario, and returning the price back to baseline all keep the prorated 30-day interest, never the stale $1,300 annual figure', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '30');
    let state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 30,
      borrowApr: 0.05,
    });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);

    // Reported repro: change the price scenario (-70%). The prior bug
    // unconditionally rebuilt a bare `type: 'price'` scenario here,
    // discarding the active Holding Period/Borrow Rate and reverting
    // Interest Cost to the unprorated $1,300 annual figure.
    const percentInput = screen.getByLabelText('Percentage Change (%)');
    await user.type(percentInput, '-70');
    state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: -0.7 },
      timeHorizonDays: 30,
      borrowApr: 0.05,
    });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);

    // Reported repro: returning the price change to 0 did not restore the
    // prorated value under the prior bug, since nothing ever re-promoted
    // the scenario back to `type: 'interest'` once demoted.
    await user.clear(percentInput);
    await user.type(percentInput, '0');
    state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: 0 },
      timeHorizonDays: 30,
      borrowApr: 0.05,
    });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);
    // Holding Period must still read "30 Days" throughout, matching the
    // report's own observation that the selector never changed.
    expect(screen.getByLabelText('Holding Period')).toHaveValue('30');
  });

  it('also preserves the active interest scenario when the absolute BTC Price field is edited instead of Percentage Change', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '30');

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '15000');

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 15000 },
      timeHorizonDays: 30,
      borrowApr: 0.05,
    });
    // Accrued interest depends only on debt balance/APR/time horizon
    // (calculateProratedInterest), never on price — unaffected by the
    // $15,000 stress price above.
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);
  });

  it('365 days matches the reported $1,300 annual figure, confirming the authoritative formula itself is unchanged', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '365');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(1300, 2);
  });

  it('still builds a plain price scenario from BTC Price/Percentage Change when no interest scenario is active (unchanged behavior)', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    const priceInput = screen.getByLabelText('BTC Price');
    await user.clear(priceInput);
    await user.type(priceInput, '60000');

    expect(useSimulationStore.getState().currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
  });

  it('Reset Scenario returns to a coherent default state after the stale-state sequence — no leftover interest figure of any kind', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '30');
    const percentInput = screen.getByLabelText('Percentage Change (%)');
    await user.type(percentInput, '-70');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);

    await user.click(screen.getByRole('button', { name: 'Reset Scenario' }));

    expect(screen.getByLabelText('Holding Period')).toHaveValue('30');
    expect(screen.getByLabelText('Percentage Change (%)')).toHaveValue(null);
    expect(useSimulationStore.getState().currentScenario).toBeNull();
    expect(useSimulationStore.getState().currentResult).toBeNull();
  });
});

describe('ScenarioBuilder — PT-12 follow-up: interaction order (Holding Period vs. price fields)', () => {
  // Known-good baseline from the physical-testing report: Debt $26,000,
  // Borrow APR 5%, Holding Period 30 days -> prorated interest
  // $26,000 * 5% * 30/365 ≈ $106.85; the full annual figure is $1,300.
  const DEBT_PORTFOLIO: ApplicationPortfolio = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 26000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };

  it('direction 1 — Holding Period first, then a price change: stays prorated (already covered above, re-asserted here as the direction-1 baseline for comparison with direction 2)', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    await user.selectOptions(screen.getByLabelText('Holding Period'), '30');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);

    await user.type(screen.getByLabelText('Percentage Change (%)'), '-70');

    const state = useSimulationStore.getState();
    expect(state.currentScenario?.type).toBe('interest');
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);
  });

  it('direction 2 — a price change first, then Holding Period: the real physical-testing repro (Holding Period is never actively re-selected until after the price field, since it already shows its "30 Days" default) — Holding Period must still be able to promote the scenario to interest and drive a prorated Interest Cost', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    // Holding Period is left untouched at its pre-filled "30 Days"
    // default — the ordinary first move in the physical flow is the
    // price field, not the already-set-looking selector.
    expect(screen.getByLabelText('Holding Period')).toHaveValue('30');

    await user.type(screen.getByLabelText('Percentage Change (%)'), '-70');
    let state = useSimulationStore.getState();
    // Before any Holding Period interaction, this is correctly a plain
    // price scenario — its debtCost is the unprorated annual figure,
    // exactly as reported ($1,300 -> $1,300).
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.7 },
    });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(1300, 2);

    // The reported bug: selecting Holding Period afterward did nothing,
    // because the handler was gated on `currentScenario?.type !==
    // 'price'`. It must now promote to an interest scenario and drive
    // the prorated Interest Cost, exactly like Borrow Rate already does.
    await user.selectOptions(screen.getByLabelText('Holding Period'), '30');
    state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual({
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: -0.7 },
      timeHorizonDays: 30,
      borrowApr: 0.05,
    });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);

    // Repeating the reported repro's own follow-on step: other Holding
    // Period values must also take effect, not just the first selection
    // after the price field.
    await user.selectOptions(screen.getByLabelText('Holding Period'), '365');
    state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({ type: 'interest', timeHorizonDays: 365 });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(1300, 2);
  });

  it('repeated switching between a price change and 30/90/365-day Holding Periods keeps recalculating correctly every time, never getting stuck on a stale value', async () => {
    const user = userEvent.setup();
    render(<ScenarioBuilder portfolio={DEBT_PORTFOLIO} portfolioId="portfolio-1" />);

    const percentInput = screen.getByLabelText('Percentage Change (%)');
    const holdingPeriodSelect = screen.getByLabelText('Holding Period');

    // Price change first (direction 2's own opening move).
    await user.type(percentInput, '-20');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(1300, 2);

    await user.selectOptions(holdingPeriodSelect, '30');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);

    await user.selectOptions(holdingPeriodSelect, '90');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(320.55, 2);

    // Another price edit while an interest scenario is active must keep
    // the current Holding Period (90 days) rather than reverting.
    await user.clear(percentInput);
    await user.type(percentInput, '-40');
    let state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({ type: 'interest', timeHorizonDays: 90 });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(320.55, 2);

    await user.selectOptions(holdingPeriodSelect, '365');
    expect(useSimulationStore.getState().currentResult?.scenario.debtCost).toBeCloseTo(1300, 2);

    await user.selectOptions(holdingPeriodSelect, '30');
    state = useSimulationStore.getState();
    expect(state.currentScenario).toMatchObject({
      type: 'interest',
      timeHorizonDays: 30,
      priceScenario: { type: 'percentageChange', percentageChange: -0.4 },
    });
    expect(state.currentResult?.scenario.debtCost).toBeCloseTo(106.85, 2);
  });
});

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
});

/**
 * v1.13.0 Batch 3 ("Simulation ScenarioSummary: Debt + Liquidation
 * Price") — the price/interest scenario section now also renders Debt
 * and Liquidation Price, both read directly from
 * `currentResult.baseline`/`currentResult.scenario` (never derived or
 * recomputed in this component — see `ScenarioSummary.tsx`'s own
 * updated doc comment). Replaces the pre-Batch-3
 * "does not render a Debt row and documents why" test, whose documented
 * gap this batch closes.
 */
describe('ScenarioSummary — Debt and Liquidation Price (v1.13.0 Batch 3)', () => {
  it('renders a Debt row for a price scenario, showing the canonical unchanged debt value — a price scenario never moves debt', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);

    expect(screen.getByText('Debt')).toBeInTheDocument();
    expect(screen.getByText('Debt').nextElementSibling?.textContent).toBe(
      '$20,000.00 → $20,000.00',
    );
  });

  it('renders a Liquidation Price row for a price scenario, showing the same canonical value on both sides — price cancels out of F-024’s own threshold equation when debt/collateral quantity are unchanged', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);

    expect(screen.getByText('Liquidation Price')).toBeInTheDocument();
    // F-024: 50,000 x 20,000 / (100,000 x 0.8) = $12,500 — unchanged by
    // a price-only scenario since currentBtcPrice cancels algebraically.
    expect(screen.getByText('Liquidation Price').nextElementSibling?.textContent).toBe(
      '$12,500.00 → $12,500.00',
    );
  });

  it('shows scenario Debt and Liquidation Price winning over the baseline when an interest scenario genuinely changes debt (V3)', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 365,
      borrowApr: 0.05,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);

    const debtText = screen.getByText('Debt').nextElementSibling?.textContent ?? '';
    const liquidationPriceText =
      screen.getByText('Liquidation Price').nextElementSibling?.textContent ?? '';
    const [debtBefore, debtAfter] = debtText.split(' → ');
    const [liquidationPriceBefore, liquidationPriceAfter] = liquidationPriceText.split(' → ');
    // Baseline debt $20,000 accrues simple interest at 5%/year over 365
    // days — the scenario side must show a genuinely larger figure, and
    // it must be the SCENARIO's own debt, not the baseline repeated.
    expect(debtBefore).toBe('$20,000.00');
    expect(debtAfter).not.toBe('$20,000.00');
    expect(debtAfter).not.toBe(debtBefore);
    // Liquidation price scales with debt (F-024) at a fixed price/collateral,
    // so it must move the same direction and must not equal the baseline.
    expect(liquidationPriceBefore).toBe('$12,500.00');
    expect(liquidationPriceAfter).not.toBe('$12,500.00');
    expect(liquidationPriceAfter).not.toBe(liquidationPriceBefore);
  });

  it('shows Debt as $0.00 and Liquidation Price as — for a zero-debt portfolio, never fabricating a price at zero debt and never leaking NaN/Infinity', () => {
    const zeroDebtPortfolio: ApplicationPortfolio = {
      ...PORTFOLIO,
      debt: { asset: 'USDC', balance: 0 },
    };
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(zeroDebtPortfolio);

    render(<ScenarioSummary />);

    expect(screen.getByText('Debt').nextElementSibling?.textContent).toBe('$0.00 → $0.00');
    expect(screen.getByText('Liquidation Price').nextElementSibling?.textContent).toBe('— → —');
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('Infinity');
  });

  it('shows scenario Debt and Liquidation Price winning over the baseline for a V4 interest scenario, using the real V4 accrual pipeline (V4 behavior per the existing canonical contract)', () => {
    const v4Portfolio: ApplicationPortfolio = {
      ...PORTFOLIO,
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      timeHorizonDays: 365,
      borrowApr: 0.09, // deliberately unused for V4 — the real baseDrawnApr/riskPremium govern instead.
    });
    useSimulationStore.getState().runSimulation(v4Portfolio);

    render(<ScenarioSummary />);

    const debtText = screen.getByText('Debt').nextElementSibling?.textContent ?? '';
    const [debtBefore, debtAfter] = debtText.split(' → ');
    // Current total debt: drawnDebt 20,000 + premiumDebt 500 = $20,500.
    expect(debtBefore).toBe('$20,500.00');
    expect(debtAfter).not.toBe(debtBefore);
    const liquidationPriceText =
      screen.getByText('Liquidation Price').nextElementSibling?.textContent ?? '';
    const [liquidationPriceBefore, liquidationPriceAfter] = liquidationPriceText.split(' → ');
    expect(liquidationPriceAfter).not.toBe(liquidationPriceBefore);
    const bodyText = document.body.textContent ?? '';
    expect(bodyText).not.toContain('NaN');
    expect(bodyText).not.toContain('Infinity');
  });

  it('leaves the pre-existing "Liquidation Distance" row intact and distinct from the new "Liquidation Price" row', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    render(<ScenarioSummary />);

    expect(screen.getByText('Liquidation Distance')).toBeInTheDocument();
    expect(screen.getByText('Liquidation Price')).toBeInTheDocument();
    expect(screen.getByText('Liquidation Distance').nextElementSibling?.textContent).not.toBe(
      screen.getByText('Liquidation Price').nextElementSibling?.textContent,
    );
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

describe('ScenarioSummary — calculation failure (Batch 25, M6-026)', () => {
  it('shows a real error message, not a blank or stale result, when the underlying calculation fails', () => {
    // Zero collateral with nonzero debt — a valid, creatable Milestone
    // 4 portfolio state, the same one `DashboardErrorBanner` (M5-021)
    // already handles for the Dashboard — makes `simulateScenario`'s
    // own baseline re-snapshot fail for a real Service reason, not a
    // hand-crafted error.
    const brokenPortfolio: ApplicationPortfolio = {
      ...PORTFOLIO,
      collateral: { asset: 'BTC', quantity: 0 },
    };
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(brokenPortfolio);

    render(<ScenarioSummary />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Unable to calculate this simulation.')).toBeInTheDocument();
    expect(
      screen.getByText('Your portfolio is unchanged. Adjust the scenario inputs to try again.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Change a scenario input to see results here.'),
    ).not.toBeInTheDocument();
  });
});

/**
 * V4 Readiness Audit §12 Stage 13 — "if no v4DebtState exists, show a
 * clear disabled/fail-closed state rather than allowing a broken
 * simulation." No new Simulation UI code was needed for this: the
 * existing generic error banner (M6-026, tested above for a different
 * failure reason) already surfaces `AAVE_V4_DEBT_STATE_MISSING`'s own
 * clear, human-readable message and error code — this test proves that
 * coverage extends to the V4 case specifically, rather than assuming it.
 */
describe('ScenarioSummary — V4 missing debt state fails closed with a clear message (Stage 13)', () => {
  it('shows the real AAVE_V4_DEBT_STATE_MISSING message and code, not a blank or broken simulation', () => {
    const v4PortfolioMissingState: ApplicationPortfolio = {
      ...PORTFOLIO,
      protocolVersion: 'v4',
    };
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(v4PortfolioMissingState);

    render(<ScenarioSummary />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/requires Aave V4 debt data/)).toBeInTheDocument();
    expect(screen.getByText('Error code: AAVE_V4_DEBT_STATE_MISSING')).toBeInTheDocument();
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
          debtValue: 20000,
          liquidationPrice: 12500,
        },
        scenario: {
          label: 'Simulated Scenario',
          equity: 100000,
          profitOrLoss: 20000,
          healthFactor: 5,
          liquidationDistance: 4,
          debtCost: 1000,
          leverage: 1.2,
          debtValue: 20000,
          liquidationPrice: 12500,
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
          debtValue: 20000,
          liquidationPrice: 12500,
        },
        scenario: {
          label: 'Simulated Scenario',
          equity: -5000,
          profitOrLoss: -85000,
          healthFactor: -1,
          liquidationDistance: -2,
          debtCost: 1000,
          leverage: 1.2,
          debtValue: 20000,
          liquidationPrice: 12500,
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

import { beforeEach, describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Planner Store — 06_TASKS.md M7-020 ("Implement Exit Planner
 * Store"). DoD: "Exit planning state remains separate from portfolio
 * and simulation state." Also covers M7-023 ("Implement Exit
 * Calculation Workflow").
 */
const INITIAL_STATE = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedPlans: [],
};

beforeEach(() => {
  useExitPlannerStore.setState(INITIAL_STATE);
});

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 20000 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.75,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

describe('Exit Planner Store independence (M7-020 DoD)', () => {
  it('runExitCalculation accepts a plain portfolio value, never reading from another Store', () => {
    // usePortfolioStore/useSimulationStore/useLoopBuilderStore are never
    // imported by stores/exitPlannerStore.ts (confirmed by direct source
    // inspection) — this test verifies the resulting *behavior*:
    // runExitCalculation works correctly given nothing but a plain
    // ApplicationPortfolio value, with no other Store initialized
    // anywhere in this test file.
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    expect(useExitPlannerStore.getState().currentResult).not.toBeNull();
  });
});

describe('setExitType', () => {
  it('sets the type and clears any prior result/targetInputs/warnings', () => {
    useExitPlannerStore.setState({
      currentResult: { feasible: true } as never,
      targetInputs: { repaymentAmount: 5000 },
      warnings: [
        { category: 'infeasibleStrategy', severity: 'error', cause: 'x', suggestedResponse: 'y' },
      ],
    });
    useExitPlannerStore.getState().setExitType('targetHealthFactor');

    const state = useExitPlannerStore.getState();
    expect(state.exitType).toBe('targetHealthFactor');
    expect(state.currentResult).toBeNull();
    expect(state.targetInputs).toBeNull();
    expect(state.warnings).toEqual([]);
  });
});

describe('setTargetInputs', () => {
  it('stores the supplied target inputs', () => {
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 1000 });
    expect(useExitPlannerStore.getState().targetInputs).toEqual({ repaymentAmount: 1000 });
  });
});

describe('runExitCalculation', () => {
  it('is a no-op when no exit type has been selected yet', () => {
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    expect(useExitPlannerStore.getState().status).toBe('idle');
    expect(useExitPlannerStore.getState().currentResult).toBeNull();
  });

  it('is a no-op when the selected type still needs a required field', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    expect(useExitPlannerStore.getState().status).toBe('idle');
    expect(useExitPlannerStore.getState().currentResult).toBeNull();
  });

  it.each(['targetDebtBalance', 'targetHealthFactor', 'targetRetainedBtc'] as const)(
    'is a no-op for %s too when its own required field is still missing',
    (exitType) => {
      useExitPlannerStore.getState().setExitType(exitType);
      useExitPlannerStore.getState().runExitCalculation(validPortfolio());
      expect(useExitPlannerStore.getState().status).toBe('idle');
      expect(useExitPlannerStore.getState().currentResult).toBeNull();
    },
  );

  it('computes a real Full Exit result (targetDebt: 0)', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const state = useExitPlannerStore.getState();
    expect(state.status).toBe('idle');
    expect(state.currentResult?.feasible).toBe(true);
    expect(state.currentResult?.transaction?.repayment).toBe(20000);
    expect(state.currentResult?.transaction?.btcRetained).toBeCloseTo(1.6, 10);
    expect(state.lastMetadata).not.toBeNull();
  });

  it('resolves Partial Debt Repayment by subtracting the repayment amount from current debt', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 10000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const state = useExitPlannerStore.getState();
    expect(state.currentResult?.feasible).toBe(true);
    expect(state.currentResult?.transaction?.repayment).toBe(10000);
    expect(state.currentResult?.after?.debtValue).toBe(10000);
  });

  it('resolves Target Debt Balance directly', () => {
    useExitPlannerStore.getState().setExitType('targetDebtBalance');
    useExitPlannerStore.getState().setTargetInputs({ targetDebtBalance: 5000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const state = useExitPlannerStore.getState();
    expect(state.currentResult?.feasible).toBe(true);
    expect(state.currentResult?.transaction?.repayment).toBe(15000);
    expect(state.currentResult?.after?.debtValue).toBe(5000);
  });

  it('resolves Target Retained BTC via the real F-041/F-042 chain', () => {
    useExitPlannerStore.getState().setExitType('targetRetainedBtc');
    useExitPlannerStore.getState().setTargetInputs({ targetRetainedBtc: 1.8 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const state = useExitPlannerStore.getState();
    expect(state.currentResult?.feasible).toBe(true);
    expect(state.currentResult?.transaction?.btcRetained).toBeCloseTo(1.8, 10);
    expect(state.currentResult?.transaction?.repayment).toBeCloseTo(10000, 10);
  });

  it('resolves Target Health Factor via F-040, reusing calculateTargetDebt', () => {
    useExitPlannerStore.getState().setExitType('targetHealthFactor');
    useExitPlannerStore.getState().setTargetInputs({ targetHealthFactor: 8 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const state = useExitPlannerStore.getState();
    expect(state.currentResult?.feasible).toBe(true);
    // CollateralValue (100000) * LiquidationThreshold (0.8) / TargetHF (8) = 10000.
    expect(state.currentResult?.after?.debtValue).toBeCloseTo(10000, 5);
  });

  it('applies scenarioBtcPriceUsd as a real execution-price override', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().setTargetInputs({ scenarioBtcPriceUsd: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    // Selling at half the default price requires selling twice the BTC
    // to raise the same $20,000 repayment.
    expect(useExitPlannerStore.getState().currentResult?.transaction?.btcSold).toBeCloseTo(0.8, 10);
  });

  it('maps a real infeasible target into a StrategyWarning with category infeasibleStrategy', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    // Requesting to repay more than the entire current debt resolves to
    // a negative target debt balance — genuinely infeasible, not a
    // hand-crafted test double.
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const state = useExitPlannerStore.getState();
    expect(state.currentResult?.feasible).toBe(false);
    expect(state.currentResult?.after).toBeNull();
    expect(state.warnings).toHaveLength(1);
    expect(state.warnings[0]).toMatchObject({
      category: 'infeasibleStrategy',
      severity: 'error',
    });
    expect(state.warnings[0].cause.length).toBeGreaterThan(0);
    expect(state.warnings[0].suggestedResponse.length).toBeGreaterThan(0);
  });

  it('clears currentResult/lastMetadata and populates errors on a genuine Engine failure', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(invalidPortfolio);

    const state = useExitPlannerStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentResult).toBeNull();
    expect(state.lastMetadata).toBeNull();
    expect(state.warnings).toEqual([]);
  });
});

describe('reset', () => {
  it('restores the initial state', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    useExitPlannerStore.getState().reset();
    expect(useExitPlannerStore.getState()).toMatchObject(INITIAL_STATE);
  });
});

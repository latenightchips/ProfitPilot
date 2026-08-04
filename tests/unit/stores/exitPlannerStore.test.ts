import { beforeEach, describe, expect, it } from 'vitest';

import { type ApplicationPortfolio, autoSaveCoordinator, persistenceService } from '@/services';
import type { SavedExitPlan } from '@/stores/exitPlannerStore';
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
  priceSensitivity: null,
  priceSensitivityErrors: [],
  savedPlans: [],
  selectedPlanId: null,
};

beforeEach(() => {
  useExitPlannerStore.setState(INITIAL_STATE);
  window.localStorage.clear();
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

  it('gives a type-specific suggestedResponse, not one generic sentence for every type (M7-027)', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const partialRepaymentSuggestion = useExitPlannerStore.getState().warnings[0].suggestedResponse;

    useExitPlannerStore.getState().setExitType('targetDebtBalance');
    useExitPlannerStore.getState().setTargetInputs({ targetDebtBalance: -1 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const targetDebtBalanceSuggestion =
      useExitPlannerStore.getState().warnings[0].suggestedResponse;

    expect(partialRepaymentSuggestion).not.toBe(targetDebtBalanceSuggestion);
  });

  it('sets status/errors on a genuine Engine failure, with no prior result to preserve', () => {
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

  it('preserves a real prior valid result across a subsequent failure for the same exit type (M7-038 "Restore last valid result")', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const validState = useExitPlannerStore.getState();
    expect(validState.currentResult).not.toBeNull();
    expect(validState.lastMetadata).not.toBeNull();

    const invalidPortfolio: ApplicationPortfolio = {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    useExitPlannerStore.getState().runExitCalculation(invalidPortfolio);

    const state = useExitPlannerStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentResult).toEqual(validState.currentResult);
    expect(state.lastMetadata).toEqual(validState.lastMetadata);
  });
});

describe('runPriceSensitivity (M7-028)', () => {
  it('is a no-op when no exit type has been selected yet', () => {
    useExitPlannerStore.getState().runPriceSensitivity(validPortfolio());
    expect(useExitPlannerStore.getState().priceSensitivity).toBeNull();
  });

  it('is a no-op when the selected type still needs a required field — reachable at the Store-API level even though the UI never exposes it this way', () => {
    // The real UI (ExitPriceSensitivity.tsx) only shows its own "Run
    // Price Sensitivity" button once a `currentResult` already exists,
    // which itself requires the same target inputs `runExitCalculation`
    // already resolved successfully — but this Store action has no such
    // structural guard of its own, so calling it directly with an
    // incomplete `targetInputs` is a real path through this Store's own
    // public contract, not a hypothetical.
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().runPriceSensitivity(validPortfolio());
    expect(useExitPlannerStore.getState().priceSensitivity).toBeNull();
  });

  it('computes 4 real points via the real Exit Planning Service, reusing the same target at each price', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    useExitPlannerStore.getState().runPriceSensitivity(validPortfolio());

    const points = useExitPlannerStore.getState().priceSensitivity;
    expect(points).toHaveLength(4);
    expect(points?.map((point) => point.label)).toEqual([
      'Current Price',
      'User Target Price',
      'Lower-Price Case (-20%)',
      'Higher-Price Case (+20%)',
    ]);
    // Selling at a lower price requires selling more BTC to raise the
    // same $20,000 repayment for this Full Exit target.
    const lower = points?.find((point) => point.label.startsWith('Lower'));
    const higher = points?.find((point) => point.label.startsWith('Higher'));
    expect(lower?.result.transaction?.btcSold).toBeGreaterThan(
      higher?.result.transaction?.btcSold ?? 0,
    );
  });

  it('carries a genuinely infeasible per-point result through unchanged, rather than dropping it', () => {
    // A repayment amount larger than the current debt resolves to a
    // negative target debt balance, price-independently — genuinely
    // infeasible at every one of the 4 points, not gated out by the
    // whole feature.
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 25000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    useExitPlannerStore.getState().runPriceSensitivity(validPortfolio());

    const points = useExitPlannerStore.getState().priceSensitivity;
    expect(points).toHaveLength(4);
    expect(points?.every((point) => point.result.feasible === false)).toBe(true);
    expect(points?.every((point) => point.result.transaction === null)).toBe(true);
  });

  it('reflects a real scenarioBtcPriceUsd override as the User Target Price point', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().setTargetInputs({ scenarioBtcPriceUsd: 40000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    useExitPlannerStore.getState().runPriceSensitivity(validPortfolio());

    const points = useExitPlannerStore.getState().priceSensitivity;
    const userTarget = points?.find((point) => point.label === 'User Target Price');
    expect(userTarget?.priceUsd).toBe(40000);
  });

  it('never mutates the active portfolio value passed in', () => {
    const portfolio = validPortfolio();
    const snapshot = JSON.parse(JSON.stringify(portfolio));
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(portfolio);
    useExitPlannerStore.getState().runPriceSensitivity(portfolio);
    expect(portfolio).toEqual(snapshot);
  });

  it('is cleared by setTargetInputs', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    useExitPlannerStore.getState().runPriceSensitivity(validPortfolio());
    expect(useExitPlannerStore.getState().priceSensitivity).not.toBeNull();

    useExitPlannerStore.getState().setTargetInputs({});
    expect(useExitPlannerStore.getState().priceSensitivity).toBeNull();
  });
});

describe('saveExitPlan/loadExitPlan/duplicateExitPlan/deleteExitPlan (M7-029)', () => {
  it('saveExitPlan returns null and saves nothing without a current result', () => {
    const id = useExitPlannerStore
      .getState()
      .saveExitPlan({ name: 'My Exit', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    expect(id).toBeNull();
    expect(useExitPlannerStore.getState().savedPlans).toEqual([]);
  });

  it('saveExitPlan captures a frozen snapshot of exitType/targetInputs/result/warnings/metadata', () => {
    useExitPlannerStore.getState().setExitType('partialDebtRepayment');
    useExitPlannerStore.getState().setTargetInputs({ repaymentAmount: 5000 });
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());

    const id = useExitPlannerStore
      .getState()
      .saveExitPlan({ name: 'My Exit', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    expect(id).not.toBeNull();

    const saved = useExitPlannerStore.getState().savedPlans[0];
    expect(saved.name).toBe('My Exit');
    expect(saved.portfolioId).toBe('p1');
    expect(saved.portfolioUpdatedAt).toBe('t1');
    expect(saved.exitType).toBe('partialDebtRepayment');
    expect(saved.targetInputs).toEqual({ repaymentAmount: 5000 });
    expect(saved.result).toEqual(useExitPlannerStore.getState().currentResult);
    expect(saved.metadata).not.toBeNull();
  });

  it('loadExitPlan restores exitType/targetInputs/result without recalculating', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore
      .getState()
      .saveExitPlan({ name: 'My Exit', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    if (id === null) throw new Error('expected a saved id');

    useExitPlannerStore.getState().reset();
    expect(useExitPlannerStore.getState().currentResult).toBeNull();

    useExitPlannerStore.setState({
      savedPlans: [
        {
          id,
          name: 'My Exit',
          portfolioId: 'p1',
          portfolioUpdatedAt: 't1',
          exitType: 'fullExit',
          targetInputs: {},
          result: { feasible: true } as never,
          warnings: [],
          metadata: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    useExitPlannerStore.getState().loadExitPlan(id);

    const state = useExitPlannerStore.getState();
    expect(state.exitType).toBe('fullExit');
    expect(state.targetInputs).toEqual({});
    expect(state.currentResult).toEqual({ feasible: true });
    expect(state.selectedPlanId).toBe(id);
  });

  it('loadExitPlan no-ops for an unknown id', () => {
    useExitPlannerStore.getState().loadExitPlan('does-not-exist');
    expect(useExitPlannerStore.getState().currentResult).toBeNull();
  });

  it('duplicateExitPlan creates an independent copy with a new id and " (Copy)" suffix', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore
      .getState()
      .saveExitPlan({ name: 'My Exit', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    if (id === null) throw new Error('expected a saved id');

    const duplicateId = useExitPlannerStore.getState().duplicateExitPlan(id);
    expect(duplicateId).not.toBeNull();
    expect(duplicateId).not.toBe(id);

    const saved = useExitPlannerStore.getState().savedPlans;
    expect(saved).toHaveLength(2);
    const duplicate = saved.find((plan) => plan.id === duplicateId);
    expect(duplicate?.name).toBe('My Exit (Copy)');
  });

  it('duplicateExitPlan returns null for an unknown id', () => {
    const result = useExitPlannerStore.getState().duplicateExitPlan('does-not-exist');
    expect(result).toBeNull();
  });

  it('deleteExitPlan removes the matching record and clears selectedPlanId when it matches', () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore
      .getState()
      .saveExitPlan({ name: 'My Exit', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    if (id === null) throw new Error('expected a saved id');
    useExitPlannerStore.setState({ selectedPlanId: id });

    useExitPlannerStore.getState().deleteExitPlan(id);

    const state = useExitPlannerStore.getState();
    expect(state.savedPlans).toEqual([]);
    expect(state.selectedPlanId).toBeNull();
  });
});

describe('Local exit plan persistence (M8-009)', () => {
  const PORTFOLIO_UPDATED_AT = '2026-01-01T00:00:00.000Z';

  it('saveExitPlan schedules a real local storage write, readable back through persistenceService', async () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore.getState().saveExitPlan({
      name: 'My Exit',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');

    await autoSaveCoordinator.flushAll();
    const stored = await persistenceService.list<SavedExitPlan>('exitPlan');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((plan) => plan.id === id)).toBe(true);
  });

  it('duplicateExitPlan schedules a write for the new copy', async () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore.getState().saveExitPlan({
      name: 'My Exit',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');
    await autoSaveCoordinator.flushAll();

    const duplicateId = useExitPlannerStore.getState().duplicateExitPlan(id);
    if (duplicateId === null) throw new Error('expected a duplicate id');
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.list<SavedExitPlan>('exitPlan');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((plan) => plan.id === duplicateId)).toBe(true);
  });

  it('deleteExitPlan schedules removal from local storage', async () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore.getState().saveExitPlan({
      name: 'My Exit',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');
    await autoSaveCoordinator.flushAll();

    useExitPlannerStore.getState().deleteExitPlan(id);
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.list<SavedExitPlan>('exitPlan');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((plan) => plan.id === id)).toBe(false);
  });

  it('loadSavedPlans hydrates savedPlans from local storage, flushing first', async () => {
    useExitPlannerStore.getState().setExitType('fullExit');
    useExitPlannerStore.getState().runExitCalculation(validPortfolio());
    const id = useExitPlannerStore.getState().saveExitPlan({
      name: 'My Exit',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');

    useExitPlannerStore.setState({ savedPlans: [] });
    await useExitPlannerStore.getState().loadSavedPlans();

    expect(useExitPlannerStore.getState().savedPlans.some((p) => p.id === id)).toBe(true);
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

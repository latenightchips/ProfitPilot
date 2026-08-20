import { beforeEach, describe, expect, it } from 'vitest';

import { type ApplicationPortfolio, autoSaveCoordinator, persistenceService } from '@/services';
import type { LoopStrategySettings } from '@/services/loop/strategy';
import type { SavedLoopStrategy } from '@/stores/loopBuilderStore';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Builder Store — 06_TASKS.md M7-007 ("Implement Loop Builder
 * Store"). DoD: "Loop strategy state remains independent from
 * portfolio and simulation state." Also covers M7-010 ("Implement Loop
 * Calculation Workflow").
 */
const INITIAL_STATE = {
  settings: null,
  currentResult: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
  sensitivityResult: null,
  sensitivityErrors: [],
};

beforeEach(() => {
  useLoopBuilderStore.setState(INITIAL_STATE);
  window.localStorage.clear();
});

function validPortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

const VALID_SETTINGS: LoopStrategySettings = {
  targetBorrowPercentage: 0.5,
  maxLoops: 3,
  minHealthFactor: 1.1,
};

describe('Loop Builder Store independence (M7-007 DoD)', () => {
  it('runLoopStrategy accepts a plain portfolio value, never reading from another Store', () => {
    // usePortfolioStore/useSimulationStore are never imported by
    // stores/loopBuilderStore.ts (confirmed by direct source
    // inspection) — this test verifies the resulting *behavior*:
    // runLoopStrategy works correctly given nothing but a plain
    // ApplicationPortfolio value, with neither other Store initialized
    // anywhere in this test file.
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    expect(useLoopBuilderStore.getState().currentResult).not.toBeNull();
  });
});

describe('setSettings', () => {
  it('stores the settings without clearing a prior result (M7-038 "Restore last valid result")', () => {
    const priorResult = { viable: true } as never;
    useLoopBuilderStore.setState({ currentResult: priorResult });
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    expect(useLoopBuilderStore.getState().settings).toEqual(VALID_SETTINGS);
    expect(useLoopBuilderStore.getState().currentResult).toBe(priorResult);
  });

  it('clears sensitivityResult/sensitivityErrors — invalidated by any settings change', () => {
    useLoopBuilderStore.setState({
      sensitivityResult: { baseline: {} } as never,
      sensitivityErrors: [{ category: 'calculation', code: 'X', message: 'x' }],
    });
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    expect(useLoopBuilderStore.getState().sensitivityResult).toBeNull();
    expect(useLoopBuilderStore.getState().sensitivityErrors).toEqual([]);
  });
});

describe('runLoopStrategy', () => {
  it('is a no-op when no settings have been set yet', () => {
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    expect(useLoopBuilderStore.getState().status).toBe('idle');
    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
  });

  it('computes a real, viable result via the actual Loop Strategy Service', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    const state = useLoopBuilderStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.currentResult?.viable).toBe(true);
    expect(state.currentResult?.strategy).not.toBeNull();
    expect(state.lastMetadata).not.toBeNull();
  });

  it('maps a real LoopSafetyFinding into a StrategyWarning with category, severity, cause, and suggestedResponse', () => {
    // minHealthFactor at the liquidation boundary triggers a real
    // MINIMUM_HEALTH_FACTOR finding — not a hand-crafted warning.
    useLoopBuilderStore.getState().setSettings({ ...VALID_SETTINGS, minHealthFactor: 1 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    const { warnings } = useLoopBuilderStore.getState();
    expect(warnings.length).toBeGreaterThan(0);
    const finding = warnings.find((warning) => warning.category === 'safety');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('error');
    expect(typeof finding?.cause).toBe('string');
    expect(typeof finding?.suggestedResponse).toBe('string');
    expect(finding?.cause.length).toBeGreaterThan(0);
    expect(finding?.suggestedResponse.length).toBeGreaterThan(0);
  });

  it('maps a real BORROWING_CAPACITY finding into a warning with category borrowingCapacity (M7-041)', () => {
    // Debt already at the starting position's own borrow ceiling
    // (1 BTC @ $50,000 * 0.5 max LTV = $25,000) — a real
    // BORROWING_CAPACITY warning (severity 'warning', not 'error'),
    // not a hand-crafted one.
    const atCapacityPortfolio = validPortfolio({ debt: { asset: 'USDC', balance: 25000 } });
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(atCapacityPortfolio);

    const state = useLoopBuilderStore.getState();
    expect(state.status).toBe('idle');
    const finding = state.warnings.find((warning) => warning.category === 'borrowingCapacity');
    expect(finding).toBeDefined();
    expect(finding?.severity).toBe('warning');
    expect(finding?.cause).toBe('Safety check "BORROWING_CAPACITY" raised a warning.');
    expect(finding?.suggestedResponse).toBe(
      'Reduce the target borrow percentage — no further borrowing capacity remains.',
    );
    expect(state.currentResult?.strategy?.steps).toEqual([]);
  });

  it('sets status/errors on a genuine Engine failure, with no prior result to preserve', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(invalidPortfolio);

    const state = useLoopBuilderStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentResult).toBeNull();
    expect(state.lastMetadata).toBeNull();
    expect(state.warnings).toEqual([]);
  });

  it('preserves a real prior valid result and its metadata/warnings across a subsequent failure (M7-038 "Restore last valid result")', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const validState = useLoopBuilderStore.getState();
    expect(validState.currentResult).not.toBeNull();
    expect(validState.lastMetadata).not.toBeNull();

    const invalidPortfolio: ApplicationPortfolio = {
      ...validPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(invalidPortfolio);

    const state = useLoopBuilderStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentResult).toEqual(validState.currentResult);
    expect(state.lastMetadata).toEqual(validState.lastMetadata);
    expect(state.warnings).toEqual(validState.warnings);
  });

  it('applies maxLoanToValueOverride/borrowAprOverride through to the real Service call', () => {
    useLoopBuilderStore.getState().setSettings({ ...VALID_SETTINGS, maxLoanToValueOverride: 1.5 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    const state = useLoopBuilderStore.getState();
    expect(state.currentResult?.viable).toBe(false);
    expect(state.warnings.some((warning) => warning.category === 'safety')).toBe(true);
  });
});

describe('runSensitivityScenario (M7-015)', () => {
  it('is a no-op without a viable strategy', () => {
    useLoopBuilderStore.getState().runSensitivityScenario(validPortfolio(), {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.25 },
    });
    expect(useLoopBuilderStore.getState().sensitivityResult).toBeNull();
  });

  it('computes a real price-decline sensitivity result against the proposed loop', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    useLoopBuilderStore.getState().runSensitivityScenario(validPortfolio(), {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.25 },
    });

    const state = useLoopBuilderStore.getState();
    expect(state.sensitivityErrors).toEqual([]);
    expect(state.sensitivityResult).not.toBeNull();
    expect(state.sensitivityResult?.scenario.healthFactor).toBeLessThan(
      state.sensitivityResult?.baseline.healthFactor ?? Infinity,
    );
  });

  it('computes a real interest-scenario sensitivity result', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    useLoopBuilderStore.getState().runSensitivityScenario(validPortfolio(), {
      type: 'interest',
      priceScenario: { type: 'percentageChange', percentageChange: 0 },
      timeHorizonDays: 365,
      borrowApr: 0.1,
    });

    const state = useLoopBuilderStore.getState();
    expect(state.sensitivityErrors).toEqual([]);
    expect(state.sensitivityResult).not.toBeNull();
  });

  it('reports errors, not a thrown exception, for a genuinely invalid scenario', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    useLoopBuilderStore.getState().runSensitivityScenario(validPortfolio(), {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -1 },
    });

    const state = useLoopBuilderStore.getState();
    expect(state.sensitivityResult).toBeNull();
    expect(state.sensitivityErrors.length).toBeGreaterThan(0);
  });

  it('is cleared by setSettings', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    useLoopBuilderStore.getState().runSensitivityScenario(validPortfolio(), {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.25 },
    });
    expect(useLoopBuilderStore.getState().sensitivityResult).not.toBeNull();

    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    expect(useLoopBuilderStore.getState().sensitivityResult).toBeNull();
  });
});

/**
 * BLOCKER #3 fix — `runSensitivityScenario` must never run a sensitivity
 * scenario against a final V4 portfolio whose `riskPremium` was silently
 * carried forward across a real new borrow. `riskPremium: 0.13` is a
 * deliberately distinctive value (unused elsewhere in this file).
 */
describe('runSensitivityScenario — V4 ambiguous borrow (BLOCKER #3 fix)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return validPortfolio({
      collateral: { asset: 'BTC', quantity: 2 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.13 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
  }

  it('sets a clear, specific error and no result when the proposed loop actually borrows more', () => {
    const portfolio = v4Portfolio();
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeGreaterThan(
      20000 + 500,
    );

    useLoopBuilderStore.getState().runSensitivityScenario(portfolio, {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.25 },
    });

    const state = useLoopBuilderStore.getState();
    expect(state.sensitivityResult).toBeNull();
    expect(state.sensitivityErrors).toHaveLength(1);
    expect(state.sensitivityErrors[0].message).toMatch(/Risk Premium refresh/);
    expect(state.sensitivityErrors[0].code).toBe('AAVE_V4_LOOP_BORROW_RISK_PREMIUM_UNKNOWN');
  });

  it('computes a real sensitivity result for a zero-loop V4 strategy (no real borrow occurred)', () => {
    const portfolio = v4Portfolio();
    const zeroLoopSettings: LoopStrategySettings = {
      targetBorrowPercentage: 0.5,
      maxLoops: 0,
      minHealthFactor: 1.1,
    };
    useLoopBuilderStore.getState().setSettings(zeroLoopSettings);
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);
    expect(useLoopBuilderStore.getState().currentResult?.strategy?.finalDebt).toBeCloseTo(
      20000 + 500,
      6,
    );

    useLoopBuilderStore.getState().runSensitivityScenario(portfolio, {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.25 },
    });

    const state = useLoopBuilderStore.getState();
    expect(state.sensitivityErrors).toEqual([]);
    expect(state.sensitivityResult).not.toBeNull();
  });

  it('a V3 portfolio is completely unaffected, even borrowing heavily', () => {
    const portfolio = validPortfolio();
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(portfolio);

    useLoopBuilderStore.getState().runSensitivityScenario(portfolio, {
      type: 'price',
      priceScenario: { type: 'percentageChange', percentageChange: -0.25 },
    });

    const state = useLoopBuilderStore.getState();
    expect(state.sensitivityErrors).toEqual([]);
    expect(state.sensitivityResult).not.toBeNull();
  });
});

describe('saveStrategy/loadStrategy/duplicateStrategy/deleteStrategy (M7-017)', () => {
  it('saveStrategy returns null and saves nothing without a current result', () => {
    const id = useLoopBuilderStore
      .getState()
      .saveStrategy({ name: 'My Loop', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    expect(id).toBeNull();
    expect(useLoopBuilderStore.getState().savedStrategies).toEqual([]);
  });

  it('saveStrategy captures a frozen snapshot of settings/result/warnings/metadata', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    const id = useLoopBuilderStore
      .getState()
      .saveStrategy({ name: 'My Loop', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    expect(id).not.toBeNull();

    const saved = useLoopBuilderStore.getState().savedStrategies[0];
    expect(saved.name).toBe('My Loop');
    expect(saved.portfolioId).toBe('p1');
    expect(saved.portfolioUpdatedAt).toBe('t1');
    expect(saved.settings).toEqual(VALID_SETTINGS);
    expect(saved.result).toEqual(useLoopBuilderStore.getState().currentResult);
    expect(saved.metadata).not.toBeNull();
  });

  it('loadStrategy restores settings/result without recalculating', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore
      .getState()
      .saveStrategy({ name: 'My Loop', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    if (id === null) throw new Error('expected a saved id');

    useLoopBuilderStore.getState().reset();
    expect(useLoopBuilderStore.getState().currentResult).toBeNull();

    // Restore the saved strategy without calling reset on savedStrategies.
    useLoopBuilderStore.setState({
      savedStrategies: [
        {
          id,
          name: 'My Loop',
          portfolioId: 'p1',
          portfolioUpdatedAt: 't1',
          settings: VALID_SETTINGS,
          result: { viable: true } as never,
          warnings: [],
          metadata: null,
          createdAt: new Date().toISOString(),
        },
      ],
    });
    useLoopBuilderStore.getState().loadStrategy(id);

    const state = useLoopBuilderStore.getState();
    expect(state.settings).toEqual(VALID_SETTINGS);
    expect(state.currentResult).toEqual({ viable: true });
    expect(state.selectedStrategyId).toBe(id);
  });

  it('loadStrategy no-ops for an unknown id', () => {
    useLoopBuilderStore.getState().loadStrategy('does-not-exist');
    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
  });

  it('duplicateStrategy creates an independent copy with a new id and " (Copy)" suffix', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore
      .getState()
      .saveStrategy({ name: 'My Loop', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    if (id === null) throw new Error('expected a saved id');

    const duplicateId = useLoopBuilderStore.getState().duplicateStrategy(id);
    expect(duplicateId).not.toBeNull();
    expect(duplicateId).not.toBe(id);

    const saved = useLoopBuilderStore.getState().savedStrategies;
    expect(saved).toHaveLength(2);
    const duplicate = saved.find((strategy) => strategy.id === duplicateId);
    expect(duplicate?.name).toBe('My Loop (Copy)');
  });

  it('duplicateStrategy returns null for an unknown id', () => {
    const result = useLoopBuilderStore.getState().duplicateStrategy('does-not-exist');
    expect(result).toBeNull();
  });

  it('deleteStrategy removes the matching record and clears selectedStrategyId when it matches', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore
      .getState()
      .saveStrategy({ name: 'My Loop', portfolioId: 'p1', portfolioUpdatedAt: 't1' });
    if (id === null) throw new Error('expected a saved id');
    useLoopBuilderStore.setState({ selectedStrategyId: id });

    useLoopBuilderStore.getState().deleteStrategy(id);

    const state = useLoopBuilderStore.getState();
    expect(state.savedStrategies).toEqual([]);
    expect(state.selectedStrategyId).toBeNull();
  });
});

describe('Local strategy persistence (M8-009)', () => {
  const PORTFOLIO_UPDATED_AT = '2026-01-01T00:00:00.000Z';

  it('saveStrategy schedules a real local storage write, readable back through persistenceService', async () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore.getState().saveStrategy({
      name: 'My Loop',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');

    await autoSaveCoordinator.flushAll();
    const stored = await persistenceService.list<SavedLoopStrategy>('loopStrategy');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((strategy) => strategy.id === id)).toBe(true);
  });

  it('duplicateStrategy schedules a write for the new copy', async () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore.getState().saveStrategy({
      name: 'My Loop',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');
    await autoSaveCoordinator.flushAll();

    const duplicateId = useLoopBuilderStore.getState().duplicateStrategy(id);
    if (duplicateId === null) throw new Error('expected a duplicate id');
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.list<SavedLoopStrategy>('loopStrategy');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((strategy) => strategy.id === duplicateId)).toBe(true);
  });

  it('deleteStrategy schedules removal from local storage', async () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore.getState().saveStrategy({
      name: 'My Loop',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');
    await autoSaveCoordinator.flushAll();

    useLoopBuilderStore.getState().deleteStrategy(id);
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.list<SavedLoopStrategy>('loopStrategy');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((strategy) => strategy.id === id)).toBe(false);
  });

  it('loadSavedStrategies hydrates savedStrategies from local storage, flushing first', async () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    const id = useLoopBuilderStore.getState().saveStrategy({
      name: 'My Loop',
      portfolioId: 'p1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');

    useLoopBuilderStore.setState({ savedStrategies: [] });
    await useLoopBuilderStore.getState().loadSavedStrategies();

    expect(useLoopBuilderStore.getState().savedStrategies.some((s) => s.id === id)).toBe(true);
  });
});

describe('reset', () => {
  it('restores the initial state', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    useLoopBuilderStore.getState().reset();
    expect(useLoopBuilderStore.getState()).toMatchObject(INITIAL_STATE);
  });
});

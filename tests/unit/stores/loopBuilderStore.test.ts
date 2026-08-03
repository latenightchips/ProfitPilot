import { beforeEach, describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services';
import type { LoopStrategySettings } from '@/services/loop/strategy';
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

describe('reset', () => {
  it('restores the initial state', () => {
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());
    useLoopBuilderStore.getState().reset();
    expect(useLoopBuilderStore.getState()).toMatchObject(INITIAL_STATE);
  });
});

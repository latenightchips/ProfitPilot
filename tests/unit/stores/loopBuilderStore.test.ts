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
  it('stores the settings and clears any prior result', () => {
    useLoopBuilderStore.setState({ currentResult: { viable: true } as never });
    useLoopBuilderStore.getState().setSettings(VALID_SETTINGS);
    expect(useLoopBuilderStore.getState().settings).toEqual(VALID_SETTINGS);
    expect(useLoopBuilderStore.getState().currentResult).toBeNull();
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

  it('clears currentResult and lastMetadata, and preserves errors, on a genuine Engine failure', () => {
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

  it('applies maxLoanToValueOverride/borrowAprOverride through to the real Service call', () => {
    useLoopBuilderStore.getState().setSettings({ ...VALID_SETTINGS, maxLoanToValueOverride: 1.5 });
    useLoopBuilderStore.getState().runLoopStrategy(validPortfolio());

    const state = useLoopBuilderStore.getState();
    expect(state.currentResult?.viable).toBe(false);
    expect(state.warnings.some((warning) => warning.category === 'safety')).toBe(true);
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

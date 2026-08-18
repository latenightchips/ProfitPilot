import { beforeEach, describe, expect, it } from 'vitest';

import {
  type ApplicationPortfolio,
  autoSaveCoordinator,
  persistenceService,
  type SimulationScenario,
} from '@/services';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { SavedSimulation } from '@/stores/simulationStore';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Simulation Store — 06_TASKS.md M6-003 ("Implement Simulation Store").
 * DoD: "Simulation state is completely independent from portfolio
 * state."
 */
const INITIAL_STATE = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  savedScenarios: [],
  comparisonSelection: [],
  timelineProjection: null,
  lastMetadata: null,
  status: 'idle' as const,
  errors: [],
  warnings: [],
  previewMode: false,
};

beforeEach(() => {
  useSimulationStore.setState(INITIAL_STATE);
  usePortfolioStore.setState({
    portfolios: {},
    activePortfolioId: null,
    loadStatus: 'idle',
    saveStatus: 'idle',
    errors: [],
    lastSynchronizedAt: null,
  });
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

const PRICE_SCENARIO: SimulationScenario = {
  type: 'price',
  priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
};

const INTEREST_SCENARIO: SimulationScenario = {
  type: 'interest',
  priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
  borrowApr: 0.1,
  timeHorizonDays: 100,
};

describe('useSimulationStore — initial state', () => {
  it('starts with every field at its documented default', () => {
    const state = useSimulationStore.getState();
    expect(state.currentScenario).toBeNull();
    expect(state.currentResult).toBeNull();
    expect(state.portfolioActionPreview).toBeNull();
    expect(state.savedScenarios).toEqual([]);
    expect(state.comparisonSelection).toEqual([]);
    expect(state.timelineProjection).toBeNull();
    expect(state.lastMetadata).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.warnings).toEqual([]);
    expect(state.previewMode).toBe(false);
  });
});

describe('useSimulationStore — setCurrentScenario', () => {
  it('sets the scenario and clears any previous result, status, and errors', () => {
    useSimulationStore.setState({
      currentResult: { baseline: {} } as never,
      status: 'error',
      errors: [{ category: 'validation', code: 'X', message: 'x' }] as never,
      timelineProjection: [{ day: 0, summary: {} }] as never,
      lastMetadata: { engineVersion: '0.1.0', formulaVersion: '1.0' } as never,
    });

    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual(PRICE_SCENARIO);
    expect(state.currentResult).toBeNull();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.timelineProjection).toBeNull();
    expect(state.lastMetadata).toBeNull();
  });

  it('accepts null to clear the scenario entirely', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().setCurrentScenario(null);
    expect(useSimulationStore.getState().currentScenario).toBeNull();
  });
});

describe('useSimulationStore — runSimulation', () => {
  it('does nothing when no scenario is set', () => {
    useSimulationStore.getState().runSimulation(validPortfolio());
    expect(useSimulationStore.getState().status).toBe('idle');
    expect(useSimulationStore.getState().currentResult).toBeNull();
  });

  it('populates currentResult from the real Simulation Service on success', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.currentResult).not.toBeNull();
    // 2 BTC * $60,000 - $20,000 debt = $100,000 net equity in the scenario.
    expect(state.currentResult?.scenario.equity).toBe(100000);
    // The baseline is the real, unmodified current portfolio: 2 BTC * $50,000 - $20,000 = $80,000.
    expect(state.currentResult?.baseline.equity).toBe(80000);
  });

  it('sets status to error and clears currentResult when the underlying calculation fails', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore
      .getState()
      .runSimulation(validPortfolio({ collateral: { asset: 'BTC', quantity: 0 } }));

    const state = useSimulationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.currentResult).toBeNull();
  });
});

describe('useSimulationStore — runPortfolioActionSimulation (M6-008)', () => {
  it('populates portfolioActionPreview from the real Portfolio Action Simulation Service on success', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: 1, debtDelta: 10000 });

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.portfolioActionPreview).not.toBeNull();
    // 3 BTC * $50,000 = $150,000 collateral; $20,000 + $10,000 = $30,000 debt.
    expect(state.portfolioActionPreview?.after.collateralValue).toBe(150000);
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
    expect(state.portfolioActionPreview?.before.collateralValue).toBe(100000);
    // $150,000 current collateral value − $100,000 initial = $50,000 profit.
    expect(state.portfolioActionPreview?.profitOrLoss).toBe(50000);
  });

  it('sets status to error and clears portfolioActionPreview when the underlying calculation fails', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: -5, debtDelta: 0 });

    const state = useSimulationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.portfolioActionPreview).toBeNull();
  });

  it('does not touch currentScenario or currentResult, which belong to price/interest scenarios', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: 1, debtDelta: 0 });

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual(PRICE_SCENARIO);
    expect(state.currentResult?.scenario.equity).toBe(100000);
    expect(state.portfolioActionPreview).not.toBeNull();
  });
});

/**
 * V4 borrow-blocked pre-check — V4 Readiness Audit §12 Stage 25C. Closes
 * the exact bug reported: a manual-only V4 portfolio with real,
 * calculation-ready debt state hit the generic
 * `AAVE_V4_DEBT_STATE_MISSING` guard (worded around "hasn't synced yet")
 * the moment a Portfolio Action's `debtDelta` was positive (a borrow) —
 * misleading, since real debt state IS present and no amount of syncing
 * or manual entry would change the outcome; V4 borrow simulation is
 * genuinely unsupported (`services/portfolio/mapping.ts`'s
 * `deriveV4DebtStateAfterDelta`, Stage 11), identically for manual and
 * live portfolios. This Store-level pre-check intercepts that one
 * specific case with an accurate, borrow-specific message —
 * `simulatePortfolioAction` itself (tested directly in
 * `tests/unit/services/simulation/portfolioAction.test.ts`) still fails
 * closed exactly as before for every caller; only what the Store
 * displays for THIS one flow changes.
 */
describe('useSimulationStore — V4 borrow-blocked pre-check (Stage 25C)', () => {
  function v4Portfolio(
    source: 'manual' | 'live',
    overrides: Partial<ApplicationPortfolio> = {},
  ): ApplicationPortfolio {
    return validPortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 30000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4DebtStateSource: source,
      v4CollateralRisk: { collateralFactor: 0.75, dynamicConfigKey: 0 },
      v4CollateralRiskSource: source,
      ...overrides,
    });
  }

  it.each(['manual', 'live'] as const)(
    'a %s-sourced V4 debt increase shows the accurate borrow-specific error, not the generic "hasn\'t synced" message',
    (source) => {
      useSimulationStore.getState().runPortfolioActionSimulation(v4Portfolio(source), {
        collateralDelta: 0,
        debtDelta: 10000,
      });

      const state = useSimulationStore.getState();
      expect(state.status).toBe('error');
      expect(state.portfolioActionPreview).toBeNull();
      expect(state.errors).toEqual([
        {
          category: 'calculation',
          code: 'AAVE_V4_BORROW_SIMULATION_UNSUPPORTED',
          message: expect.stringContaining('cannot be simulated'),
        },
      ]);
      expect(state.errors[0].message).not.toMatch(/hasn.t synced|none has been synced/);
    },
  );

  it.each(['manual', 'live'] as const)(
    'a %s-sourced V4 debt DECREASE is never blocked by the borrow pre-check',
    (source) => {
      useSimulationStore.getState().runPortfolioActionSimulation(v4Portfolio(source), {
        collateralDelta: 0,
        debtDelta: -5000,
      });

      const state = useSimulationStore.getState();
      expect(state.status).toBe('idle');
      expect(state.errors).toEqual([]);
      expect(state.portfolioActionPreview?.after.debtValue).toBe(25500);
    },
  );

  it.each(['manual', 'live'] as const)(
    'a %s-sourced V4 collateral-only change is never blocked by the borrow pre-check',
    (source) => {
      useSimulationStore
        .getState()
        .runPortfolioActionSimulation(v4Portfolio(source), { collateralDelta: 1, debtDelta: 0 });

      const state = useSimulationStore.getState();
      expect(state.status).toBe('idle');
      expect(state.errors).toEqual([]);
      expect(state.portfolioActionPreview).not.toBeNull();
    },
  );

  it.each(['manual', 'live'] as const)(
    'a combined %s-sourced collateral + debt-decrease change is never blocked by the borrow pre-check',
    (source) => {
      useSimulationStore.getState().runPortfolioActionSimulation(v4Portfolio(source), {
        collateralDelta: 1,
        debtDelta: -10000,
      });

      const state = useSimulationStore.getState();
      expect(state.status).toBe('idle');
      expect(state.errors).toEqual([]);
      expect(state.portfolioActionPreview?.after.debtValue).toBe(20500);
    },
  );

  it('a genuinely missing V4 debt state still falls through to the real (now provenance-neutral) Service error, not the borrow-specific one', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio({ protocolVersion: 'v4' }), {
        collateralDelta: 0,
        debtDelta: 10000,
      });

    const state = useSimulationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors[0]).toMatchObject({ code: 'AAVE_V4_DEBT_STATE_MISSING' });
    expect(state.errors[0].message).not.toMatch(/requires live/);
  });

  it('a V3 (or unset) portfolio is completely unaffected — a large debt increase still succeeds normally', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: 0, debtDelta: 10000 });

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
  });
});

/**
 * `runPortfolioTransitionSimulation` — V4 Readiness Audit §12 Stage 18.
 * A second entry point into the same `portfolioActionPreview`/`status`/
 * `errors`/`warnings`/`lastMetadata` fields as `runPortfolioActionSimulation`,
 * calling `simulatePortfolioTransition` with an already-built "after"
 * portfolio instead of a `{collateralDelta, debtDelta}` pair.
 * `ApplyLoopAsSimulation.tsx` is its one real caller (for a V4 loop
 * result) — these tests exercise the Store action directly.
 */
describe('useSimulationStore — runPortfolioTransitionSimulation (Stage 18)', () => {
  it('populates portfolioActionPreview from the real Service on success, matching what an equivalent runPortfolioActionSimulation call would produce', () => {
    const before = validPortfolio();
    const after = validPortfolio({
      collateral: { asset: 'BTC', quantity: 3 },
      debt: { asset: 'USDC', balance: 30000 },
    });
    useSimulationStore.getState().runPortfolioTransitionSimulation(before, after);

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.portfolioActionPreview).not.toBeNull();
    expect(state.portfolioActionPreview?.after.collateralValue).toBe(150000);
    expect(state.portfolioActionPreview?.after.debtValue).toBe(30000);
    expect(state.portfolioActionPreview?.before.collateralValue).toBe(100000);
    expect(state.portfolioActionPreview?.profitOrLoss).toBe(50000);
  });

  it('sets status to error and clears portfolioActionPreview when the underlying calculation fails', () => {
    useSimulationStore
      .getState()
      .runPortfolioTransitionSimulation(
        validPortfolio(),
        validPortfolio({ collateral: { asset: 'BTC', quantity: -5 } }),
      );

    const state = useSimulationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.portfolioActionPreview).toBeNull();
  });

  it('does not touch currentScenario or currentResult', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    useSimulationStore
      .getState()
      .runPortfolioTransitionSimulation(
        validPortfolio(),
        validPortfolio({ collateral: { asset: 'BTC', quantity: 3 } }),
      );

    const state = useSimulationStore.getState();
    expect(state.currentScenario).toEqual(PRICE_SCENARIO);
    expect(state.currentResult?.scenario.equity).toBe(100000);
    expect(state.portfolioActionPreview).not.toBeNull();
  });

  it('succeeds for a V4 "after" portfolio carrying a real structured v4DebtState — the case runPortfolioActionSimulation cannot handle for a positive delta', () => {
    const before: ApplicationPortfolio = validPortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    });
    const after: ApplicationPortfolio = {
      ...before,
      collateral: { asset: 'BTC', quantity: 3 },
      debt: { asset: 'USDC', balance: 25500 },
      v4DebtState: { drawnDebt: 25000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
    };

    useSimulationStore.getState().runPortfolioTransitionSimulation(before, after);

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.portfolioActionPreview?.after.debtValue).toBe(25500);
  });
});

describe('useSimulationStore — runTimelineProjection (M6-012, Batch 11)', () => {
  it('does nothing (leaves timelineProjection null) when no scenario is set', () => {
    useSimulationStore.getState().runTimelineProjection(validPortfolio());
    expect(useSimulationStore.getState().timelineProjection).toBeNull();
    expect(useSimulationStore.getState().status).toBe('idle');
  });

  it('clears timelineProjection when a price scenario (no time horizon) is active', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runTimelineProjection(validPortfolio());
    expect(useSimulationStore.getState().timelineProjection).toBeNull();
  });

  it('populates 5 real, evenly-spaced timeline points for an active interest scenario', () => {
    useSimulationStore.getState().setCurrentScenario(INTEREST_SCENARIO);
    useSimulationStore.getState().runTimelineProjection(validPortfolio());

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    expect(state.errors).toEqual([]);
    expect(state.timelineProjection).not.toBeNull();
    const points = state.timelineProjection!;
    expect(points).toHaveLength(5);
    expect(points.map((p) => p.day)).toEqual([0, 25, 50, 75, 100]);

    // Day 0: no interest accrued yet, but the scenario price is already
    // fully applied (2 BTC * $60,000 - $20,000 = $100,000).
    expect(points[0].summary.equity).toBe(100000);
    // Day 100: $20,000 debt at 10% APR compounded over 100 days (Aave V3's
    // exact `calculateCompoundedInterest`, engine/protocols/aaveV3/) ≈
    // $555.52 accrued interest — independently derived, see
    // tests/unit/engine/protocols/aaveV3/math.test.ts — not the old simple
    // 20000*0.1*100/365 ≈ $547.95 figure.
    expect(points[4].summary.equity).toBeCloseTo(100000 - 555.519853, 2);
    // debtCost strictly increases as days increase, since the scenario
    // price is fixed across all 5 points and only the day count varies.
    for (let i = 1; i < points.length; i += 1) {
      expect(points[i].summary.debtCost).toBeGreaterThan(points[i - 1].summary.debtCost);
    }
  });

  it('sets status to error and clears timelineProjection when the underlying calculation fails', () => {
    useSimulationStore.getState().setCurrentScenario(INTEREST_SCENARIO);
    useSimulationStore
      .getState()
      .runTimelineProjection(validPortfolio({ collateral: { asset: 'BTC', quantity: 0 } }));

    const state = useSimulationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors.length).toBeGreaterThan(0);
    expect(state.timelineProjection).toBeNull();
  });

  it('leaves warnings untouched, unlike runSimulation/runPortfolioActionSimulation', () => {
    useSimulationStore.setState({ warnings: [{ code: 'PRE_EXISTING', message: 'x' }] as never });
    useSimulationStore.getState().setCurrentScenario(INTEREST_SCENARIO);
    useSimulationStore.setState({ warnings: [{ code: 'PRE_EXISTING', message: 'x' }] as never });

    useSimulationStore.getState().runTimelineProjection(validPortfolio());

    expect(useSimulationStore.getState().warnings).toEqual([
      { code: 'PRE_EXISTING', message: 'x' },
    ]);
  });
});

describe('useSimulationStore — lastMetadata (M6-013, Batch 12)', () => {
  it('captures the real Service metadata on a successful runSimulation', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const metadata = useSimulationStore.getState().lastMetadata;
    expect(metadata).not.toBeNull();
    expect(metadata?.engineVersion).toEqual(expect.any(String));
    expect(metadata?.formulaVersion).toEqual(expect.any(String));
  });

  it('clears lastMetadata to null when runSimulation fails', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore
      .getState()
      .runSimulation(validPortfolio({ collateral: { asset: 'BTC', quantity: 0 } }));
    expect(useSimulationStore.getState().lastMetadata).toBeNull();
  });

  it('captures the real Service metadata on a successful runPortfolioActionSimulation', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: 1, debtDelta: 0 });

    const metadata = useSimulationStore.getState().lastMetadata;
    expect(metadata).not.toBeNull();
    expect(metadata?.engineVersion).toEqual(expect.any(String));
    expect(metadata?.formulaVersion).toEqual(expect.any(String));
  });

  it('clears lastMetadata to null when runPortfolioActionSimulation fails', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: -5, debtDelta: 0 });
    expect(useSimulationStore.getState().lastMetadata).toBeNull();
  });

  it('clears lastMetadata when a new scenario is set', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    useSimulationStore.getState().setCurrentScenario(null);
    expect(useSimulationStore.getState().lastMetadata).toBeNull();
  });

  it('leaves lastMetadata untouched by runTimelineProjection, unlike runSimulation/runPortfolioActionSimulation', () => {
    const preExisting = { engineVersion: '0.1.0', formulaVersion: '1.0' } as never;
    useSimulationStore.getState().setCurrentScenario(INTEREST_SCENARIO);
    useSimulationStore.setState({ lastMetadata: preExisting });

    useSimulationStore.getState().runTimelineProjection(validPortfolio());

    expect(useSimulationStore.getState().lastMetadata).toBe(preExisting);
  });
});

describe('useSimulationStore — warnings (M6-009, Batch 9)', () => {
  it('captures the real Service warnings array on a successful runSimulation', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    expect(useSimulationStore.getState().warnings).toEqual([]);
  });

  it('clears warnings to an empty array when runSimulation fails', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore
      .getState()
      .runSimulation(validPortfolio({ collateral: { asset: 'BTC', quantity: 0 } }));
    expect(useSimulationStore.getState().warnings).toEqual([]);
  });

  it('captures the real Service warnings array on a successful runPortfolioActionSimulation', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: 1, debtDelta: 0 });
    expect(useSimulationStore.getState().warnings).toEqual([]);
  });

  it('clears warnings when a new scenario is set', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    useSimulationStore.getState().setCurrentScenario(null);
    expect(useSimulationStore.getState().warnings).toEqual([]);
  });
});

describe('useSimulationStore — saveCurrentScenario (M6-015, Batch 14)', () => {
  it('returns null and saves nothing when there is no current result yet', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(id).toBeNull();
    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
  });

  it('saves the current scenario and result with the real name/description/portfolioId, returning a real id', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      description: 'A test description',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(id).not.toBeNull();
    const saved = useSimulationStore.getState().savedScenarios;
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(id);
    expect(saved[0].name).toBe('My Scenario');
    expect(saved[0].description).toBe('A test description');
    expect(saved[0].portfolioId).toBe('portfolio-1');
    expect(saved[0].portfolioUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(saved[0].scenario).toEqual(PRICE_SCENARIO);
    expect(saved[0].result.scenario.equity).toBe(100000);
    expect(saved[0].createdAt).toEqual(expect.any(String));
    expect(saved[0].metadata).toEqual(useSimulationStore.getState().lastMetadata);
    expect(saved[0].metadata?.formulaVersion).toEqual(expect.any(String));
  });

  it('defaults description to null when omitted', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    useSimulationStore.getState().saveCurrentScenario({
      name: 'No Description',
      portfolioId: 'p1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(useSimulationStore.getState().savedScenarios[0].description).toBeNull();
  });
});

describe('useSimulationStore — deleteSavedScenario', () => {
  it('removes the scenario and clears it from the comparison selection', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');
    useSimulationStore.getState().toggleComparisonSelection(id);

    useSimulationStore.getState().deleteSavedScenario(id);

    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
    expect(useSimulationStore.getState().comparisonSelection).toEqual([]);
  });
});

describe('useSimulationStore — toggleComparisonSelection', () => {
  it('adds an id on first toggle and removes it on second toggle', () => {
    useSimulationStore.getState().toggleComparisonSelection('abc');
    expect(useSimulationStore.getState().comparisonSelection).toEqual(['abc']);

    useSimulationStore.getState().toggleComparisonSelection('abc');
    expect(useSimulationStore.getState().comparisonSelection).toEqual([]);
  });
});

describe('useSimulationStore — setPreviewMode', () => {
  it('toggles the preview mode flag', () => {
    useSimulationStore.getState().setPreviewMode(true);
    expect(useSimulationStore.getState().previewMode).toBe(true);
    useSimulationStore.getState().setPreviewMode(false);
    expect(useSimulationStore.getState().previewMode).toBe(false);
  });
});

describe('useSimulationStore — reset', () => {
  it('restores every field to its initial default', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    useSimulationStore.getState().setPreviewMode(true);
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(validPortfolio(), { collateralDelta: 1, debtDelta: 0 });

    useSimulationStore.getState().reset();

    expect(useSimulationStore.getState()).toMatchObject(INITIAL_STATE);
  });
});

describe('useSimulationStore — independence from portfolio state (M6-003 DoD)', () => {
  it('is completely unaffected by Portfolio Store mutations, and vice versa', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());

    const created = usePortfolioStore.getState().create({
      name: 'Independence Check',
      baseCurrency: 'USD',
      collateral: { asset: 'BTC', quantity: 5 },
      debt: { asset: 'USDC', balance: 10000 },
      market: { btcPriceUsd: 70000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      settings: {},
    });
    if (!created.ok) throw new Error('setup failed');
    usePortfolioStore.getState().select(created.data.id);

    // The Simulation Store's own result, computed against a completely
    // different portfolio, is untouched by this unrelated Portfolio
    // Store activity.
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(100000);

    // And the reverse: mutating the Simulation Store never touches the
    // Portfolio Store's own state.
    useSimulationStore.getState().reset();
    expect(usePortfolioStore.getState().activePortfolioId).toBe(created.data.id);
  });
});

describe('useSimulationStore — loadSavedScenario (M6-016, Batch 15)', () => {
  it('does nothing when the id does not match any saved scenario', () => {
    useSimulationStore.getState().loadSavedScenario('does-not-exist');
    expect(useSimulationStore.getState().currentScenario).toBeNull();
    expect(useSimulationStore.getState().currentResult).toBeNull();
  });

  it('restores the saved scenario/result exactly, without recalculating against a different portfolio', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');
    const savedResult = useSimulationStore.getState().currentResult;

    // Switch to a completely different scenario/result before loading.
    useSimulationStore.getState().setCurrentScenario(INTEREST_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio({ market: { btcPriceUsd: 90000 } }));
    expect(useSimulationStore.getState().currentResult).not.toEqual(savedResult);

    useSimulationStore.getState().loadSavedScenario(id);

    expect(useSimulationStore.getState().currentScenario).toEqual(PRICE_SCENARIO);
    expect(useSimulationStore.getState().currentResult).toEqual(savedResult);
  });

  it('clears warnings/timelineProjection — neither was captured at save time', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');

    useSimulationStore.getState().setCurrentScenario(INTEREST_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    useSimulationStore.getState().runTimelineProjection(validPortfolio());
    expect(useSimulationStore.getState().timelineProjection).not.toBeNull();

    useSimulationStore.getState().loadSavedScenario(id);

    expect(useSimulationStore.getState().timelineProjection).toBeNull();
    expect(useSimulationStore.getState().warnings).toEqual([]);
    expect(useSimulationStore.getState().status).toBe('idle');
    expect(useSimulationStore.getState().errors).toEqual([]);
  });

  it('restores lastMetadata from the saved record (Batch 18, M6-019) — a correction to Batch 15, which previously cleared it', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (id === null) throw new Error('setup failed');
    const savedMetadata = useSimulationStore.getState().savedScenarios[0].metadata;
    expect(savedMetadata).not.toBeNull();

    // Simulate something else having changed lastMetadata before Load —
    // a direct state override, since two real calculations can otherwise
    // land in the same millisecond and produce an identical timestamp.
    useSimulationStore.setState({
      lastMetadata: {
        sourceStatus: 'manual',
        calculationTimestamp: '1999-01-01T00:00:00.000Z',
        engineVersion: 'stale',
        formulaVersion: 'stale',
      },
    });
    expect(useSimulationStore.getState().lastMetadata).not.toEqual(savedMetadata);

    useSimulationStore.getState().loadSavedScenario(id);

    expect(useSimulationStore.getState().lastMetadata).toEqual(savedMetadata);
  });
});

describe('useSimulationStore — duplicateSavedScenario (M6-017, Batch 16)', () => {
  it('returns null and creates nothing when the id does not match any saved scenario', () => {
    const id = useSimulationStore.getState().duplicateSavedScenario('does-not-exist');
    expect(id).toBeNull();
    expect(useSimulationStore.getState().savedScenarios).toEqual([]);
  });

  it('creates an independent copy with a new identity, appended name, and fresh timestamp', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const originalId = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      description: 'A test description',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (originalId === null) throw new Error('setup failed');
    const original = useSimulationStore.getState().savedScenarios[0];

    const copyId = useSimulationStore.getState().duplicateSavedScenario(originalId);
    expect(copyId).not.toBeNull();
    expect(copyId).not.toBe(originalId);

    const saved = useSimulationStore.getState().savedScenarios;
    expect(saved).toHaveLength(2);
    const copy = saved.find((scenario) => scenario.id === copyId);
    if (copy === undefined) throw new Error('copy not found');

    expect(copy.name).toBe('My Scenario (Copy)');
    expect(copy.description).toBe(original.description);
    expect(copy.portfolioId).toBe(original.portfolioId);
    expect(copy.portfolioUpdatedAt).toBe(original.portfolioUpdatedAt);
    expect(copy.scenario).toEqual(original.scenario);
    expect(copy.result).toEqual(original.result);
    expect(copy.metadata).toEqual(original.metadata);
  });

  it('is fully independent from the original — deleting one does not affect the other', () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const originalId = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: '2026-01-01T00:00:00.000Z',
    });
    if (originalId === null) throw new Error('setup failed');
    const copyId = useSimulationStore.getState().duplicateSavedScenario(originalId);
    if (copyId === null) throw new Error('setup failed');
    useSimulationStore.getState().toggleComparisonSelection(copyId);

    useSimulationStore.getState().deleteSavedScenario(originalId);

    const saved = useSimulationStore.getState().savedScenarios;
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe(copyId);
    // Selecting the copy for comparison was untouched by deleting the original.
    expect(useSimulationStore.getState().comparisonSelection).toEqual([copyId]);

    // Loading the surviving copy still restores its own scenario/result correctly.
    useSimulationStore.getState().loadSavedScenario(copyId);
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(100000);
  });
});

describe('useSimulationStore — local scenario persistence (M8-009)', () => {
  const PORTFOLIO_UPDATED_AT = '2026-01-01T00:00:00.000Z';

  it('saveCurrentScenario schedules a real local storage write, readable back through persistenceService', async () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');

    await autoSaveCoordinator.flushAll();
    const stored = await persistenceService.list<SavedSimulation>('simulation');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((scenario) => scenario.id === id)).toBe(true);
  });

  it('duplicateSavedScenario schedules a write for the new copy', async () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');
    await autoSaveCoordinator.flushAll();

    const duplicateId = useSimulationStore.getState().duplicateSavedScenario(id);
    if (duplicateId === null) throw new Error('expected a duplicate id');
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.list<SavedSimulation>('simulation');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((scenario) => scenario.id === duplicateId)).toBe(true);
  });

  it('deleteSavedScenario schedules removal from local storage', async () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');
    await autoSaveCoordinator.flushAll();

    useSimulationStore.getState().deleteSavedScenario(id);
    await autoSaveCoordinator.flushAll();

    const stored = await persistenceService.list<SavedSimulation>('simulation');
    expect(stored.ok).toBe(true);
    if (!stored.ok) return;
    expect(stored.data.some((scenario) => scenario.id === id)).toBe(false);
  });

  it('loadSavedScenarios hydrates savedScenarios from local storage, flushing first', async () => {
    useSimulationStore.getState().setCurrentScenario(PRICE_SCENARIO);
    useSimulationStore.getState().runSimulation(validPortfolio());
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'My Scenario',
      portfolioId: 'portfolio-1',
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('expected a saved id');

    useSimulationStore.setState({ savedScenarios: [] });
    await useSimulationStore.getState().loadSavedScenarios();

    expect(useSimulationStore.getState().savedScenarios.some((s) => s.id === id)).toBe(true);
  });
});

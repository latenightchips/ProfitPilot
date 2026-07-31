import { beforeEach, describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Simulation Integration Tests — 06_TASKS.md M6-024 ("Create
 * Integration Tests"). Dependencies: M6-023. Description: "Test:
 * Scenario creation, Scenario editing, Scenario comparison, Simulation
 * saving, Simulation loading." DoD: "Simulation workflows operate
 * correctly."
 *
 * Follows the exact precedent `tests/integration/dashboard/dashboardWorkflows.test.ts`
 * (M5-026) and `tests/integration/portfolio/portfolioWorkflows.test.ts`
 * (M4-018) already established: no React rendering — chain real,
 * non-mocked `useSimulationStore` calls together across multiple
 * sequential steps, one `describe` block per item in this task's own
 * "Test" list, in order. `tests/unit/stores/simulationStore.test.ts`'s
 * own extensive suite (Batches 1–21) already exhaustively covers every
 * individual Store action in isolation; what is new here is following
 * one scenario through a realistic multi-step user workflow (create →
 * edit → compare → save → load) in a single continuous test, the same
 * "state remains consistent across transitions" property Batch 16
 * established for the Dashboard, applied here to the Simulation
 * Workspace's own DoD wording ("Simulation workflows operate
 * correctly").
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

const PORTFOLIO_ID = 'portfolio-1';
const PORTFOLIO_UPDATED_AT = '2026-01-01T00:00:00.000Z';

beforeEach(() => {
  useSimulationStore.getState().reset();
});

describe('Cover: Scenario creation (M6-024)', () => {
  it('creating a price scenario computes and stores a real, Service-derived result', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    const state = useSimulationStore.getState();
    expect(state.status).toBe('idle');
    // 2 BTC * $60,000 − $20,000 debt = $100,000.
    expect(state.currentResult?.scenario.equity).toBe(100000);
    expect(state.currentResult?.baseline.equity).toBe(80000);
  });

  it('creating a portfolio action scenario computes independently of any price/interest scenario', () => {
    useSimulationStore
      .getState()
      .runPortfolioActionSimulation(PORTFOLIO, { collateralDelta: 1, debtDelta: 0 });

    const state = useSimulationStore.getState();
    // 3 BTC * $50,000 − $20,000 debt = $130,000.
    expect(state.portfolioActionPreview?.after.netEquity).toBe(130000);
    // The independent price/interest scenario fields are untouched —
    // M6-003's own "completely independent" DoD, re-confirmed here at
    // the workflow level, not just per-action.
    expect(state.currentScenario).toBeNull();
    expect(state.currentResult).toBeNull();
  });
});

describe('Cover: Scenario editing (M6-024)', () => {
  it('changing the scenario input re-computes a fresh result, not the stale prior one', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(100000);

    // Editing the BTC Price field, the same live-update principle
    // `ScenarioBuilder.tsx` itself follows ("no Calculate button").
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 70000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);

    // 2 BTC * $70,000 − $20,000 debt = $120,000 — a genuinely new
    // result, not the $100,000 figure left over from the first edit.
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(120000);
  });

  it('editing an interest scenario’s Borrow Rate re-triggers the timeline projection with the new rate', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      borrowApr: 0.05,
      timeHorizonDays: 100,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    useSimulationStore.getState().runTimelineProjection(PORTFOLIO);
    const before = useSimulationStore.getState().timelineProjection;
    expect(before).not.toBeNull();
    const finalInterestCostBefore = before?.at(-1)?.summary.debtCost;

    // Editing Borrow Rate — a real ScenarioBuilder.tsx field — to a
    // higher rate, re-running exactly the two Store actions that field
    // itself calls (M6-006/M6-012, Batch 6/11).
    useSimulationStore.getState().setCurrentScenario({
      type: 'interest',
      priceScenario: { type: 'absolute', btcPriceUsd: 50000 },
      borrowApr: 0.2,
      timeHorizonDays: 100,
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    useSimulationStore.getState().runTimelineProjection(PORTFOLIO);
    const after = useSimulationStore.getState().timelineProjection;
    const finalInterestCostAfter = after?.at(-1)?.summary.debtCost;

    expect(finalInterestCostAfter).not.toBe(finalInterestCostBefore);
    expect(finalInterestCostAfter).toBeGreaterThan(finalInterestCostBefore ?? 0);
  });
});

describe('Cover: Scenario comparison (M6-024)', () => {
  function saveScenario(btcPriceUsd: number, name: string): string {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const id = useSimulationStore.getState().saveCurrentScenario({
      name,
      portfolioId: PORTFOLIO_ID,
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('setup failed');
    return id;
  }

  it('toggling comparison selection never recalculates a saved scenario’s own already-computed result', () => {
    const idA = saveScenario(60000, 'Bull Case');
    const idB = saveScenario(70000, 'Bull Case Plus');
    const resultsBefore = useSimulationStore.getState().savedScenarios.map((s) => s.result);

    useSimulationStore.getState().toggleComparisonSelection(idA);
    useSimulationStore.getState().toggleComparisonSelection(idB);
    useSimulationStore.getState().toggleComparisonSelection(idA);
    useSimulationStore.getState().toggleComparisonSelection(idA);

    // M6-010's own DoD ("without recalculation") verified at its
    // strongest: each saved result object stays reference-identical
    // (`===`) after repeated selection toggling — `toggleComparisonSelection`
    // never touches `savedScenarios` at all (confirmed by source), so
    // this is a structural guarantee, not merely equal-by-value.
    const resultsAfter = useSimulationStore.getState().savedScenarios.map((s) => s.result);
    expect(resultsAfter[0]).toBe(resultsBefore[0]);
    expect(resultsAfter[1]).toBe(resultsBefore[1]);
    // Re-adding A after removing it appends it, so the final selection
    // order is [B, A] — the toggle sequence's own real behavior, not
    // insertion order.
    expect(useSimulationStore.getState().comparisonSelection).toEqual([idB, idA]);
  });

  it('the comparison selection reflects exactly the saved scenarios chosen, independent of save order', () => {
    const idA = saveScenario(60000, 'Bull Case');
    const idB = saveScenario(70000, 'Bear Case');
    const idC = saveScenario(80000, 'Base Case');

    useSimulationStore.getState().toggleComparisonSelection(idC);
    useSimulationStore.getState().toggleComparisonSelection(idA);

    const state = useSimulationStore.getState();
    const selected = state.savedScenarios.filter((s) => state.comparisonSelection.includes(s.id));
    expect(selected.map((s) => s.name).sort()).toEqual(['Base Case', 'Bull Case']);
    expect(selected.some((s) => s.id === idB)).toBe(false);
  });
});

describe('Cover: Simulation saving (M6-024)', () => {
  it('a saved scenario carries the exact scenario/result/metadata active at the moment of saving', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const { currentScenario, currentResult, lastMetadata } = useSimulationStore.getState();

    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'Saved Snapshot',
      description: 'A real workflow save',
      portfolioId: PORTFOLIO_ID,
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('setup failed');

    const saved = useSimulationStore.getState().savedScenarios[0];
    expect(saved.id).toBe(id);
    expect(saved.name).toBe('Saved Snapshot');
    expect(saved.description).toBe('A real workflow save');
    expect(saved.scenario).toEqual(currentScenario);
    expect(saved.result).toBe(currentResult);
    expect(saved.metadata).toBe(lastMetadata);
    expect(saved.portfolioId).toBe(PORTFOLIO_ID);
    expect(saved.portfolioUpdatedAt).toBe(PORTFOLIO_UPDATED_AT);
  });

  it('saving does not clear or otherwise mutate the currently active scenario', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 65000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const equityBefore = useSimulationStore.getState().currentResult?.scenario.equity;

    useSimulationStore.getState().saveCurrentScenario({
      name: 'Does Not Clear',
      portfolioId: PORTFOLIO_ID,
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });

    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(equityBefore);
    expect(useSimulationStore.getState().currentScenario).not.toBeNull();
  });
});

describe('Cover: Simulation loading (M6-024)', () => {
  it('loading a saved scenario restores its exact original result, even after the active scenario has since diverged', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const originalMetadata = useSimulationStore.getState().lastMetadata;
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'Original',
      portfolioId: PORTFOLIO_ID,
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('setup failed');

    // The user keeps working — a real, later, unrelated scenario change.
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 30000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    expect(useSimulationStore.getState().currentResult?.scenario.equity).toBe(40000);

    useSimulationStore.getState().loadSavedScenario(id);

    const state = useSimulationStore.getState();
    // M6-016's own DoD ("Historical simulations remain reproducible")
    // — the exact original result, not a value recalculated against the
    // portfolio at load time.
    expect(state.currentResult?.scenario.equity).toBe(100000);
    expect(state.currentScenario).toEqual({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    // The original Formula Version/timestamp is restored too (Batch
    // 18's own M6-019 correction), not the metadata from the diverged
    // $30,000 scenario in between.
    expect(state.lastMetadata).toBe(originalMetadata);
  });

  it('loading preserves the comparison selection made before the load, since Load and Compare are independent concerns', () => {
    useSimulationStore.getState().setCurrentScenario({
      type: 'price',
      priceScenario: { type: 'absolute', btcPriceUsd: 60000 },
    });
    useSimulationStore.getState().runSimulation(PORTFOLIO);
    const id = useSimulationStore.getState().saveCurrentScenario({
      name: 'Selected And Loaded',
      portfolioId: PORTFOLIO_ID,
      portfolioUpdatedAt: PORTFOLIO_UPDATED_AT,
    });
    if (id === null) throw new Error('setup failed');
    useSimulationStore.getState().toggleComparisonSelection(id);

    useSimulationStore.getState().loadSavedScenario(id);

    expect(useSimulationStore.getState().comparisonSelection).toEqual([id]);
  });
});

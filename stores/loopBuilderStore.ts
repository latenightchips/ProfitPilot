import { create } from 'zustand';

import {
  type ApplicationError,
  type ApplicationPortfolio,
  autoSaveCoordinator,
  buildFinalLoopPortfolio,
  type LoopSafetyCheck,
  type LoopStrategyPreview,
  type LoopStrategySettings,
  persistenceService,
  planLoopStrategy,
  type ServiceMetadata,
  simulateScenario,
  type SimulationResult,
  type SimulationScenario,
} from '@/services';
import type { StrategyWarning, StrategyWarningCategory } from '@/types/strategy';

/**
 * Loop Builder Store — 06_TASKS.md M7-007 ("Implement Loop Builder
 * Store"). Dependencies: M7-006. Priority P0, Effort M. Description:
 * "Create Zustand state for loop strategies." DoD: "Loop strategy state
 * remains independent from portfolio and simulation state."
 *
 * **Independence is structural, not just a comment** — the same
 * "never import `usePortfolioStore`/`useSimulationStore`, accept a
 * plain `ApplicationPortfolio` value at call time" precedent
 * `stores/simulationStore.ts`'s own header comment already established
 * for M6-003.
 *
 * **`CHECK_CATEGORY`/`CHECK_SUGGESTED_RESPONSE` map the Engine's own
 * 6-value `LoopSafetyCheck` union (`validateLoopStrategySafety`,
 * M2-018) into the shared `StrategyWarning` shape (M7-005, Batch 1) —
 * no new classification invented, just a display mapping for values
 * the Engine already produces.** `toStrategyWarning` is this Store's
 * own implementation of M7-005's own forward reference ("M7-013...
 * declare an explicit M7-005 dependency for exactly this reason") —
 * done here in Batch 2 rather than deferred to M7-013 (Batch 3),
 * since leaving genuinely available safety findings completely
 * unsurfaced until a later batch would contradict this engagement's
 * own "never let genuinely available data sit unused" discipline (the
 * same reasoning `ScenarioSummary.tsx`'s own Batch 9 "Warnings" section
 * already applied for Simulation).
 *
 * Milestone 7 Batch 3 adds `runSensitivityScenario` (M7-015) and
 * `saveStrategy`/`loadStrategy`/`duplicateStrategy`/`deleteStrategy`
 * (M7-017). `runSensitivityScenario` reuses `simulateScenario` (M3-009)
 * directly against `buildFinalLoopPortfolio`'s output (the proposed
 * loop's own final state, not the starting portfolio) — "baseline" in
 * the resulting `SimulationResult` is therefore the proposed loop
 * itself, and "scenario" is that same position under an adverse
 * price/rate assumption. No new calculation; this Store's only job is
 * holding the result, the same "trigger an already-real Service call,
 * hold the result" precedent `runSimulation`
 * (`stores/simulationStore.ts`) already established. A no-op without a
 * viable `currentResult.strategy`. Cleared by `setSettings` alongside
 * `currentResult` itself, since a changed strategy invalidates any
 * sensitivity result computed against the old one.
 *
 * `saveStrategy`/`loadStrategy`/`duplicateStrategy`/`deleteStrategy`
 * mirror `stores/simulationStore.ts`'s own
 * `saveCurrentScenario`/`loadSavedScenario`/`duplicateSavedScenario`/
 * `deleteSavedScenario` verbatim in shape: `crypto.randomUUID()`
 * identity, `" (Copy)"` duplicate-naming convention, Load restores
 * already-computed values directly without recalculating (preserving
 * original assumptions). `SavedLoopStrategy` gains
 * `portfolioId`/`portfolioUpdatedAt` (the same drift-detection snapshot
 * `SavedSimulation` already carries) and `warnings`/`metadata` (frozen
 * snapshots of this Store's own ephemeral fields at save time). M7-017's
 * own Store list also names "Assumptions" — deliberately not stored as
 * its own field, since it is fully reconstructable from
 * `settings`/`portfolioId` at load time via the already-shared
 * `StrategyAssumptionsPanel` (M7-005).
 */
const CHECK_CATEGORY: Record<LoopSafetyCheck, StrategyWarningCategory> = {
  VALID_PROTOCOL_PARAMETERS: 'safety',
  LIQUIDATION_PROXIMITY: 'liquidation',
  MINIMUM_HEALTH_FACTOR: 'safety',
  BORROWING_CAPACITY: 'borrowingCapacity',
  MAXIMUM_LTV: 'safety',
  MAXIMUM_LOOP_COUNT: 'safety',
};

const CHECK_SUGGESTED_RESPONSE: Record<LoopSafetyCheck, string> = {
  VALID_PROTOCOL_PARAMETERS:
    'Correct the Maximum LTV/Borrow-Rate Assumption so they describe a valid protocol configuration.',
  LIQUIDATION_PROXIMITY:
    'Reduce leverage or add collateral before looping — the starting position is already too close to liquidation.',
  MINIMUM_HEALTH_FACTOR:
    'Raise the Minimum Health Factor floor, or reduce Borrow Percentage Per Step/Maximum Number of Loops.',
  BORROWING_CAPACITY:
    'Reduce the target borrow percentage — no further borrowing capacity remains.',
  MAXIMUM_LTV: 'Reduce the target borrow percentage — the resulting LTV would exceed the maximum.',
  MAXIMUM_LOOP_COUNT: 'Reduce the requested Maximum Number of Loops.',
};

function toStrategyWarning(finding: {
  check: LoopSafetyCheck;
  severity: 'error' | 'warning';
}): StrategyWarning {
  return {
    category: CHECK_CATEGORY[finding.check],
    severity: finding.severity,
    cause: `Safety check "${finding.check}" ${finding.severity === 'error' ? 'failed' : 'raised a warning'}.`,
    suggestedResponse: CHECK_SUGGESTED_RESPONSE[finding.check],
  };
}

export interface SavedLoopStrategy {
  id: string;
  name: string;
  portfolioId: string;
  portfolioUpdatedAt: string;
  settings: LoopStrategySettings;
  result: LoopStrategyPreview;
  warnings: StrategyWarning[];
  metadata: ServiceMetadata | null;
  createdAt: string;
}

export interface SaveLoopStrategyInput {
  name: string;
  portfolioId: string;
  portfolioUpdatedAt: string;
}

export type LoopBuilderStatus = 'idle' | 'calculating' | 'error';

export interface LoopBuilderStoreState {
  settings: LoopStrategySettings | null;
  currentResult: LoopStrategyPreview | null;
  status: LoopBuilderStatus;
  errors: ApplicationError[];
  warnings: StrategyWarning[];
  lastMetadata: ServiceMetadata | null;
  savedStrategies: SavedLoopStrategy[];
  selectedStrategyId: string | null;
  sensitivityResult: SimulationResult | null;
  sensitivityErrors: ApplicationError[];
}

export interface LoopBuilderStoreActions {
  setSettings: (settings: LoopStrategySettings) => void;
  runLoopStrategy: (portfolio: ApplicationPortfolio) => void;
  runSensitivityScenario: (portfolio: ApplicationPortfolio, scenario: SimulationScenario) => void;
  saveStrategy: (input: SaveLoopStrategyInput) => string | null;
  loadStrategy: (id: string) => void;
  duplicateStrategy: (id: string) => string | null;
  deleteStrategy: (id: string) => void;
  loadSavedStrategies: () => Promise<void>;
  reset: () => void;
}

const SOURCE_STATUS = 'manual';

const INITIAL_STATE: LoopBuilderStoreState = {
  settings: null,
  currentResult: null,
  status: 'idle',
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedStrategies: [],
  selectedStrategyId: null,
  sensitivityResult: null,
  sensitivityErrors: [],
};

export const useLoopBuilderStore = create<LoopBuilderStoreState & LoopBuilderStoreActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    setSettings: (settings) => {
      // `currentResult` is deliberately left untouched — M7-038 "Restore
      // last valid result." Every real caller (`LoopStrategyControls.tsx`'s
      // debounced handler, `LoopPresets.tsx`) calls `runLoopStrategy`
      // immediately after this, which either overwrites `currentResult`
      // with a real new value on success or, on failure, now preserves
      // whatever was here — see `runLoopStrategy`'s own comment below.
      set({ settings, sensitivityResult: null, sensitivityErrors: [] });
    },

    runLoopStrategy: (portfolio) => {
      const { settings } = get();
      if (settings === null) return;

      set({ status: 'calculating' });
      const result = planLoopStrategy(portfolio, settings, SOURCE_STATUS);

      if (!result.ok) {
        // `currentResult`/`lastMetadata`/`warnings` are deliberately left
        // untouched — M7-038 "Restore last valid result." A failed
        // calculation only updates `status`/`errors`; whatever the last
        // successful `planLoopStrategy` call produced (or `null`, if
        // there never was one) stays exactly as it was, so
        // `app/loop-builder/page.tsx`'s existing result section keeps
        // showing it — stale, but real — underneath the new
        // `StrategyErrorBanner`, rather than the calculation silently
        // reverting to a blank "not configured" state.
        set({ status: 'error', errors: result.errors });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        currentResult: result.data,
        lastMetadata: result.metadata,
        warnings: result.data.findings.map(toStrategyWarning),
      });
    },

    runSensitivityScenario: (portfolio, scenario) => {
      const { currentResult } = get();
      if (currentResult === null || currentResult.strategy === null) return;

      const finalPortfolio = buildFinalLoopPortfolio(portfolio, currentResult.strategy);
      const result = simulateScenario(finalPortfolio, scenario, 'Loop Sensitivity', SOURCE_STATUS);

      if (!result.ok) {
        set({ sensitivityErrors: result.errors, sensitivityResult: null });
        return;
      }

      set({ sensitivityErrors: [], sensitivityResult: result.data });
    },

    saveStrategy: (input) => {
      const { settings, currentResult, warnings, lastMetadata } = get();
      if (settings === null || currentResult === null) return null;

      const saved: SavedLoopStrategy = {
        id: crypto.randomUUID(),
        name: input.name,
        portfolioId: input.portfolioId,
        portfolioUpdatedAt: input.portfolioUpdatedAt,
        settings,
        result: currentResult,
        warnings,
        metadata: lastMetadata,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ savedStrategies: [...state.savedStrategies, saved] }));
      autoSaveCoordinator.schedule('loopStrategy', saved.id, saved);
      return saved.id;
    },

    loadStrategy: (id) => {
      const saved = get().savedStrategies.find((strategy) => strategy.id === id);
      if (saved === undefined) return;

      set({
        settings: saved.settings,
        currentResult: saved.result,
        warnings: saved.warnings,
        lastMetadata: saved.metadata,
        status: 'idle',
        errors: [],
        sensitivityResult: null,
        sensitivityErrors: [],
        selectedStrategyId: saved.id,
      });
    },

    duplicateStrategy: (id) => {
      const existing = get().savedStrategies.find((saved) => saved.id === id);
      if (existing === undefined) return null;

      const duplicate: SavedLoopStrategy = {
        ...existing,
        id: crypto.randomUUID(),
        name: `${existing.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ savedStrategies: [...state.savedStrategies, duplicate] }));
      autoSaveCoordinator.schedule('loopStrategy', duplicate.id, duplicate);
      return duplicate.id;
    },

    deleteStrategy: (id) => {
      autoSaveCoordinator.scheduleDelete('loopStrategy', id);
      set((state) => ({
        savedStrategies: state.savedStrategies.filter((saved) => saved.id !== id),
        selectedStrategyId: state.selectedStrategyId === id ? null : state.selectedStrategyId,
      }));
    },

    loadSavedStrategies: async () => {
      await autoSaveCoordinator.flushAll();
      const result = await persistenceService.list<SavedLoopStrategy>('loopStrategy');
      if (!result.ok) return;
      set({ savedStrategies: result.data });
    },

    reset: () => {
      set(INITIAL_STATE);
    },
  }),
);

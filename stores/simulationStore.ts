import { create } from 'zustand';

import {
  type ApplicationError,
  type ApplicationPortfolio,
  type PortfolioActionSimulationInput,
  type PortfolioActionSimulationResult,
  type ServiceWarning,
  simulatePortfolioAction,
  simulateScenario,
  type SimulationResult,
  type SimulationScenario,
} from '@/services';

/**
 * Simulation Store — 06_TASKS.md M6-003 ("Implement Simulation Store").
 * Dependencies: M6-002. Description: "Create Zustand state for
 * simulations." DoD: "Simulation state is completely independent from
 * portfolio state."
 *
 * **Independence is structural, not just a comment.** This file never
 * imports `stores/portfolioStore.ts` and holds no live reference or
 * subscription to it — the same in-memory, single-purpose Zustand-store
 * pattern `stores/developerModeStore.ts` (M5-022) already established,
 * applied here to a larger, 6-field Store instead of one boolean.
 * `runSimulation` accepts an already-resolved `ApplicationPortfolio`
 * value at call time, never a Store reference — matching `01_PRD.md`'s
 * own REQ-004 "SIMULATION WORKFLOW" literally ("Current Portfolio →
 * Clone Portfolio → Apply User Changes → Run Mathematical Engine..." —
 * a plain value snapshot, not a live binding). Whichever later task
 * wires this to the UI (M6-004, Scenario Builder) is the one that reads
 * the active portfolio from `portfolioStore` and passes a plain value
 * in; this Store never reaches for it itself.
 *
 * **Reuses `simulateScenario` (M3-009, `services/simulation/scenario.ts`)
 * directly — no new calculation.** That Service already exists, already
 * calls the Engine's own public simulation functions
 * (`simulatePriceScenario`/`simulateInterestScenario`, M2-019/M2-020),
 * and already returns a comparison-ready `ServiceResult<SimulationResult>`.
 * This Store's only job is holding the scenario definition, triggering
 * that already-real call, and holding the result — never re-deriving a
 * financial value itself.
 *
 * **`status`/`errors` follow `stores/portfolioStore.ts`'s own,
 * already-approved precedent for a synchronous, non-networked Store**:
 * `'calculating'` is set immediately before the (synchronous)
 * `simulateScenario` call, genuinely real and independently verifiable
 * via a direct Zustand `getState()` read, even though — like
 * `portfolioStore`'s own `saveStatus: 'saving'` — it is never
 * React-paintable in this synchronous architecture (see
 * `MILESTONE_4_COMPLETION.md`'s own "Lessons Learned" for why an honest
 * partial reality is preferable to a fabricated one).
 *
 * **`SavedSimulation` deliberately carries only `id`/`scenario`/`result`/
 * `createdAt`, not `name`/`description`/a portfolio reference** — those
 * three fields are M6-015's ("Save Simulation") own explicit "Include"
 * list, a separate, later, `P1` task whose own Dependencies name only
 * M6-003. Building its full field shape here would be inventing that
 * task's own scope, the same discipline `services/portfolio/models.ts`'s
 * own header comment already established for `ApplicationPortfolio` vs.
 * M4-001. `saveCurrentScenario` below returns the new record's `id`;
 * M6-015's own later UI is what will let a user attach a name.
 *
 * **`portfolioActionPreview` (M6-008, Batch 5)**: a second, independent
 * result field alongside `currentResult` — `PortfolioActionSimulationResult`
 * (`{ before, after, profitOrLoss }` — Batch 9 added `profitOrLoss`,
 * see `services/simulation/portfolioAction.ts`'s own header comment) is
 * a structurally different shape from `SimulationResult` (`{ baseline,
 * scenario, comparison, assumptions }`, from price/interest scenarios),
 * so it is not forced into the same field. `runPortfolioActionSimulation`
 * shares the same `status`/`errors` fields as `runSimulation` — both
 * represent "is a calculation currently in flight or failed," regardless
 * of which kind.
 *
 * **`warnings` (Batch 9, M6-009)**: both `simulateScenario` and
 * `simulatePortfolioAction` already return `ServiceWarning[]` on success
 * — this Store previously discarded them entirely. M6-009's own Display
 * list names "Warnings" as one of 8 required Scenario Summary fields;
 * capturing what the Service already computes (no new warning logic) is
 * what satisfies it honestly. Shared by both actions, the same way
 * `status`/`errors` already are — cleared to `[]` on every new run,
 * exactly like `errors`.
 */
export type SimulationStatus = 'idle' | 'calculating' | 'error';

export interface SavedSimulation {
  id: string;
  scenario: SimulationScenario;
  result: SimulationResult;
  createdAt: string;
}

export interface SimulationStoreState {
  currentScenario: SimulationScenario | null;
  currentResult: SimulationResult | null;
  portfolioActionPreview: PortfolioActionSimulationResult | null;
  savedScenarios: SavedSimulation[];
  comparisonSelection: string[];
  status: SimulationStatus;
  errors: ApplicationError[];
  warnings: ServiceWarning[];
  previewMode: boolean;
}

export interface SimulationStoreActions {
  setCurrentScenario: (scenario: SimulationScenario | null) => void;
  runSimulation: (portfolio: ApplicationPortfolio) => void;
  runPortfolioActionSimulation: (
    portfolio: ApplicationPortfolio,
    input: PortfolioActionSimulationInput,
  ) => void;
  saveCurrentScenario: () => string | null;
  deleteSavedScenario: (id: string) => void;
  toggleComparisonSelection: (id: string) => void;
  setPreviewMode: (enabled: boolean) => void;
  reset: () => void;
}

const SOURCE_STATUS = 'manual';

const INITIAL_STATE: SimulationStoreState = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  savedScenarios: [],
  comparisonSelection: [],
  status: 'idle',
  errors: [],
  warnings: [],
  previewMode: false,
};

export const useSimulationStore = create<SimulationStoreState & SimulationStoreActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    setCurrentScenario: (scenario) => {
      set({
        currentScenario: scenario,
        currentResult: null,
        status: 'idle',
        errors: [],
        warnings: [],
      });
    },

    runSimulation: (portfolio) => {
      const { currentScenario } = get();
      if (currentScenario === null) return;

      set({ status: 'calculating' });

      const result = simulateScenario(
        portfolio,
        currentScenario,
        'Simulated Scenario',
        SOURCE_STATUS,
      );

      if (!result.ok) {
        set({ status: 'error', errors: result.errors, warnings: [], currentResult: null });
        return;
      }

      set({ status: 'idle', errors: [], warnings: result.warnings, currentResult: result.data });
    },

    runPortfolioActionSimulation: (portfolio, input) => {
      set({ status: 'calculating' });

      const result = simulatePortfolioAction(portfolio, input, SOURCE_STATUS);

      if (!result.ok) {
        set({ status: 'error', errors: result.errors, warnings: [], portfolioActionPreview: null });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        warnings: result.warnings,
        portfolioActionPreview: result.data,
      });
    },

    saveCurrentScenario: () => {
      const { currentScenario, currentResult } = get();
      if (currentScenario === null || currentResult === null) return null;

      const saved: SavedSimulation = {
        id: crypto.randomUUID(),
        scenario: currentScenario,
        result: currentResult,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({ savedScenarios: [...state.savedScenarios, saved] }));
      return saved.id;
    },

    deleteSavedScenario: (id) => {
      set((state) => ({
        savedScenarios: state.savedScenarios.filter((saved) => saved.id !== id),
        comparisonSelection: state.comparisonSelection.filter((selectedId) => selectedId !== id),
      }));
    },

    toggleComparisonSelection: (id) => {
      set((state) => ({
        comparisonSelection: state.comparisonSelection.includes(id)
          ? state.comparisonSelection.filter((selectedId) => selectedId !== id)
          : [...state.comparisonSelection, id],
      }));
    },

    setPreviewMode: (enabled) => {
      set({ previewMode: enabled });
    },

    reset: () => {
      set(INITIAL_STATE);
    },
  }),
);

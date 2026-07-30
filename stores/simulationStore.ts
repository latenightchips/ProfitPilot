import { create } from 'zustand';

import {
  type ApplicationError,
  type ApplicationPortfolio,
  type PortfolioActionSimulationInput,
  type PortfolioActionSimulationResult,
  type ScenarioSummary,
  type ServiceMetadata,
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
 * **`SavedSimulation` now carries `name`/`description`/`portfolioId`
 * (Batch 14, M6-015, "Save Simulation")** — M6-015's own literal
 * "Include: Name, Description, Timestamp, Portfolio reference" list.
 * "Timestamp" was already `createdAt` (Batch 2); the other three were
 * deliberately withheld until this task, per this same header comment's
 * own prior text (see git history) — building them earlier would have
 * been inventing M6-015's own scope ahead of time, the same discipline
 * `services/portfolio/models.ts`'s own header comment already
 * established for `ApplicationPortfolio` vs. M4-001. `description` is
 * optional (`string | null`), matching M6-015's own "Include" wording
 * ("Description," not "Required description") and this project's
 * existing `Portfolio.description?: string` precedent
 * (`types/portfolio.ts`, M4-001). `portfolioId` is a plain reference
 * string, not a live binding — `04_BUILD_GUIDE.md`'s own "MULTI-PORTFOLIO
 * SUPPORT" section lists "Saved Simulations" as something each portfolio
 * conceptually owns, satisfied here by storing which portfolio was
 * active at save time; no actual per-portfolio persistence exists yet
 * (Conflict B, Milestone 8's own concern). `saveCurrentScenario` now
 * takes a `SaveSimulationInput` (`name`/`description?`/`portfolioId`)
 * instead of no arguments; its own existing guard
 * (`currentScenario === null || currentResult === null`) and Store
 * independence (no live `usePortfolioStore` import) are both unchanged
 * — the caller supplies `portfolioId` as a plain value, the same
 * pattern `runSimulation` already uses for `portfolio` itself.
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
 *
 * **`timelineProjection` (Batch 11, M6-012, "Implement Scenario
 * Timeline")**: "Display projected portfolio evolution across the
 * selected time horizon" needs *multiple* points in time, not the
 * single endpoint `runSimulation` already computes. No new Formula
 * Engine logic — `runTimelineProjection` calls the exact same, already-
 * public `simulateScenario` (M3-009) repeatedly, holding the active
 * interest scenario's own `priceScenario`/`borrowApr` fixed and varying
 * only `timeHorizonDays` across 5 evenly-spaced points from `0` to the
 * scenario's own `timeHorizonDays` (0%, 25%, 50%, 75%, 100% — a
 * reasonable, documented granularity choice, since neither
 * `06_TASKS.md` nor either spec document names a specific point count).
 * Each point's own `day` is stored alongside the full `ScenarioSummary`
 * that day's call already produces — reusing that existing type rather
 * than inventing a narrower one. Only meaningful for `type: 'interest'`
 * scenarios (`type: 'price'` has no `timeHorizonDays` at all, and no
 * time to project across) — the same "time only matters for interest
 * scenarios" reasoning `ScenarioBuilder.tsx`'s own Holding Period wiring
 * already established in Batch 7. `runTimelineProjection` deliberately
 * leaves `warnings` untouched (unlike `runSimulation`/
 * `runPortfolioActionSimulation`) — overwriting it with only the last of
 * 5 calls' own warnings would misrepresent the other 4; `warnings`
 * continues to reflect whichever single-point calculation last set it.
 *
 * **`lastMetadata` (Batch 12, M6-013, "Implement Simulation Assumptions
 * Panel")**: both `simulateScenario` and `simulatePortfolioAction`
 * already return a full `ServiceMetadata` (`sourceStatus`,
 * `calculationTimestamp`, `engineVersion`, `formulaVersion`,
 * `services/shared/result.ts`) on every call — this Store previously
 * discarded it entirely, the same gap `warnings` had before Batch 9.
 * M6-013's own "Formula version" Include item is satisfied by
 * displaying this already-computed value, not a hardcoded constant.
 * Shared by both `runSimulation`/`runPortfolioActionSimulation`, the
 * same way `warnings` already is — set on success, cleared to `null` on
 * failure (mirroring `currentResult`/`portfolioActionPreview`
 * themselves, which are also only ever populated on success). Cleared
 * by `setCurrentScenario` alongside `warnings`/`timelineProjection`, and
 * — for the same reason `runTimelineProjection` leaves `warnings`
 * untouched — also left untouched by `runTimelineProjection`, since its
 * 5 calls would otherwise overwrite it with only the last point's own
 * metadata.
 *
 * **`portfolioUpdatedAt` (Batch 15, M6-016, "Load Saved Simulation")**:
 * a new snapshot field on `SavedSimulation`/`SaveSimulationInput`,
 * distinct from `portfolioId` — M6-016's own explicit Requirement
 * "Display if portfolio has changed since creation" needs a value to
 * compare *against*, which `portfolioId` alone cannot provide. Captured
 * as a plain caller-supplied string (the active portfolio's own real
 * `Portfolio.updatedAt`, bumped unconditionally by
 * `stores/portfolioStore.ts`'s own `update` action on every mutation) —
 * this Store never imports `usePortfolioStore` to read it itself, the
 * same independence `portfolioId` already established in Batch 14. The
 * actual drift *comparison* is deliberately left to the UI layer
 * (`ScenarioComparison.tsx`), not built here — this Store only stores
 * the snapshot.
 *
 * **`loadSavedScenario` (Batch 15, M6-016)**: restores a saved
 * scenario's own already-computed `scenario`/`result` directly onto
 * `currentScenario`/`currentResult` — never calling `runSimulation`
 * again. This is what satisfies M6-016's other Requirement, "Preserve
 * original assumptions," literally: recalculating against whichever
 * portfolio happens to be active *now* would silently break
 * reproducibility the moment that portfolio has changed, exactly the
 * drift this same task's own second Requirement exists to surface, not
 * paper over. `timelineProjection`/`lastMetadata`/`warnings` are all
 * cleared, the same as `setCurrentScenario` already does — none of them
 * were captured at the original save time, so nothing stale is left
 * displayed. A missing `id` is a silent no-op, the same defensive-but-
 * practically-unreachable pattern `deleteSavedScenario`/
 * `toggleComparisonSelection` already accept for an unknown `id`.
 *
 * **`duplicateSavedScenario` (Batch 16, M6-017, "Duplicate Simulation")**:
 * M6-017 names no `Requirements` section of its own — only a Description
 * ("Allow users to duplicate a saved scenario for experimentation") and
 * a DoD ("Copies are fully independent"). Rather than invent a shape for
 * "fully independent" from nothing, this reuses
 * `stores/portfolioStore.ts`'s own already-approved `duplicate` action
 * (M4-011) verbatim as precedent for what "duplicate" already means in
 * this exact codebase: a new identity (`crypto.randomUUID()`), a fresh
 * `createdAt`, and the name suffixed with `" (Copy)"`. `scenario`/
 * `result`/`description`/`portfolioId`/`portfolioUpdatedAt` are carried
 * over unchanged — the duplicate represents the same assumptions, ready
 * to be loaded and further experimented with (M6-016's own
 * `loadSavedScenario`), not a blank slate. "Fully independent" is
 * satisfied structurally: the new entry gets its own `id`, so
 * `deleteSavedScenario`/`toggleComparisonSelection` acting on one never
 * touches the other, and neither this Store nor any component ever
 * mutates a `SavedSimulation`'s own fields in place after creation — the
 * copy and the original share no mutable reference either has a way to
 * corrupt. Returns the new record's real `id` (or `null` if the source
 * `id` does not match any saved scenario), the same `string | null`
 * contract `saveCurrentScenario` already uses for "creates a new saved
 * record."
 */
export type SimulationStatus = 'idle' | 'calculating' | 'error';

export interface SavedSimulation {
  id: string;
  name: string;
  description: string | null;
  portfolioId: string;
  portfolioUpdatedAt: string;
  scenario: SimulationScenario;
  result: SimulationResult;
  createdAt: string;
}

export interface SaveSimulationInput {
  name: string;
  description?: string;
  portfolioId: string;
  portfolioUpdatedAt: string;
}

export interface TimelinePoint {
  day: number;
  summary: ScenarioSummary;
}

export interface SimulationStoreState {
  currentScenario: SimulationScenario | null;
  currentResult: SimulationResult | null;
  portfolioActionPreview: PortfolioActionSimulationResult | null;
  savedScenarios: SavedSimulation[];
  comparisonSelection: string[];
  timelineProjection: TimelinePoint[] | null;
  lastMetadata: ServiceMetadata | null;
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
  runTimelineProjection: (portfolio: ApplicationPortfolio) => void;
  saveCurrentScenario: (input: SaveSimulationInput) => string | null;
  loadSavedScenario: (id: string) => void;
  duplicateSavedScenario: (id: string) => string | null;
  deleteSavedScenario: (id: string) => void;
  toggleComparisonSelection: (id: string) => void;
  setPreviewMode: (enabled: boolean) => void;
  reset: () => void;
}

const SOURCE_STATUS = 'manual';
const TIMELINE_POINT_FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

const INITIAL_STATE: SimulationStoreState = {
  currentScenario: null,
  currentResult: null,
  portfolioActionPreview: null,
  savedScenarios: [],
  comparisonSelection: [],
  timelineProjection: null,
  lastMetadata: null,
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
        timelineProjection: null,
        lastMetadata: null,
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
        set({
          status: 'error',
          errors: result.errors,
          warnings: [],
          currentResult: null,
          lastMetadata: null,
        });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        warnings: result.warnings,
        currentResult: result.data,
        lastMetadata: result.metadata,
      });
    },

    runPortfolioActionSimulation: (portfolio, input) => {
      set({ status: 'calculating' });

      const result = simulatePortfolioAction(portfolio, input, SOURCE_STATUS);

      if (!result.ok) {
        set({
          status: 'error',
          errors: result.errors,
          warnings: [],
          portfolioActionPreview: null,
          lastMetadata: null,
        });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        warnings: result.warnings,
        portfolioActionPreview: result.data,
        lastMetadata: result.metadata,
      });
    },

    runTimelineProjection: (portfolio) => {
      const { currentScenario } = get();
      if (currentScenario === null || currentScenario.type !== 'interest') {
        set({ timelineProjection: null });
        return;
      }

      set({ status: 'calculating' });

      const points: TimelinePoint[] = [];
      for (const fraction of TIMELINE_POINT_FRACTIONS) {
        const day = currentScenario.timeHorizonDays * fraction;
        const result = simulateScenario(
          portfolio,
          { ...currentScenario, timeHorizonDays: day },
          'Simulated Scenario',
          SOURCE_STATUS,
        );

        if (!result.ok) {
          set({ status: 'error', errors: result.errors, timelineProjection: null });
          return;
        }

        points.push({ day, summary: result.data.scenario });
      }

      set({ status: 'idle', errors: [], timelineProjection: points });
    },

    saveCurrentScenario: (input) => {
      const { currentScenario, currentResult } = get();
      if (currentScenario === null || currentResult === null) return null;

      const saved: SavedSimulation = {
        id: crypto.randomUUID(),
        name: input.name,
        description: input.description ?? null,
        portfolioId: input.portfolioId,
        portfolioUpdatedAt: input.portfolioUpdatedAt,
        scenario: currentScenario,
        result: currentResult,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({ savedScenarios: [...state.savedScenarios, saved] }));
      return saved.id;
    },

    loadSavedScenario: (id) => {
      const saved = get().savedScenarios.find((scenario) => scenario.id === id);
      if (saved === undefined) return;

      set({
        currentScenario: saved.scenario,
        currentResult: saved.result,
        timelineProjection: null,
        lastMetadata: null,
        status: 'idle',
        errors: [],
        warnings: [],
      });
    },

    duplicateSavedScenario: (id) => {
      const existing = get().savedScenarios.find((saved) => saved.id === id);
      if (existing === undefined) return null;

      const duplicate: SavedSimulation = {
        ...existing,
        id: crypto.randomUUID(),
        name: `${existing.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };

      set((state) => ({ savedScenarios: [...state.savedScenarios, duplicate] }));
      return duplicate.id;
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

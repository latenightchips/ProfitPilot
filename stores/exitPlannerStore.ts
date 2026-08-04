import { create } from 'zustand';

import {
  type ApplicationError,
  type ApplicationPortfolio,
  autoSaveCoordinator,
  type ExitPlanResult,
  type ExitTarget,
  persistenceService,
  planExit,
  type ServiceMetadata,
} from '@/services';
import type { StrategyWarning } from '@/types/strategy';

/**
 * Exit Planner Store — 06_TASKS.md M7-020 ("Implement Exit Planner
 * Store"). Dependencies: M7-019. Priority P0, Effort M. Description:
 * "Create isolated Zustand state for exit planning." Store: "Exit type,
 * Target inputs, Current result, Calculation status, Warnings, Saved
 * plans." Requirements: "Do not mutate the active portfolio." DoD:
 * "Exit planning state remains separate from portfolio and simulation
 * state."
 *
 * **Independence is structural, not just a comment** — the same "never
 * import `usePortfolioStore`/`useSimulationStore`, accept a plain
 * `ApplicationPortfolio` value at call time" precedent
 * `stores/loopBuilderStore.ts`'s own header comment already established
 * for M7-007. "Do not mutate the active portfolio" is satisfied the
 * same structural way `planExit` (M3-011) already guarantees it: every
 * exit calculation constructs and returns a brand-new
 * `ApplicationPortfolio`-shaped `after` summary — it never writes back
 * to the `portfolio` value passed in. `runPriceSensitivity` (Batch 5,
 * M7-028) calls `planExit` repeatedly against the same unmodified
 * `portfolio` value with different price overrides — never against a
 * mutated copy.
 *
 * **`ExitPlannerType`/`ExitPlannerTargetInputs` are defined here, not
 * inside `features/exit-planner/`** — the same "Store owns the shape,
 * the feature's form only converts to/from it" layering
 * `LoopStrategySettings` already established (defined at the Service
 * layer, `services/loop/strategy.ts`; `features/loop-builder/types/
 * loopStrategyControls.ts` holds only the RHF-specific form-values
 * type and its own conversion functions). `features/exit-planner/
 * types/exitTargetForm.ts` imports `ExitPlannerType` from here for its
 * own per-type Zod schemas — never the reverse, keeping this Store's
 * own independence real: it must not depend on a feature module.
 *
 * **`resolveExitTarget` maps this Store's own 5-value `ExitPlannerType`
 * onto the Engine's real 3-variant `ExitTarget` union.** "Full exit,"
 * "Partial debt repayment," and "Target debt balance" all resolve to
 * the same `{type:'debtBalance', targetDebt}` Engine variant — Full
 * Exit hardcodes `targetDebt: 0` (no input needed); Partial Debt
 * Repayment lets the user enter a repayment *amount*, resolved to
 * `targetDebt = currentDebt - repaymentAmount`; Target Debt Balance
 * lets the user enter the target balance directly. "Target Health
 * Factor" and "Target retained BTC" map 1:1 onto the Engine's own
 * `healthFactor`/`retainedBtc` variants. "Target cash proceeds" (the
 * 6th type 06_TASKS.md M7-021 names) has no variant to resolve to at
 * all — PROJECT_STATUS.md Conflict #10, already revived as "an actual
 * blocking UI gap" the moment Milestone 7 Batch 1 reached this exact
 * task; `calculateTargetExit`'s own `ExitTarget` union has exactly 3
 * variants, and its own header comment states plainly that a
 * cash-proceeds target's mechanics are not determinable from the
 * documented spec without guessing. `ExitTypeSelector.tsx` renders it
 * as an explicit, labeled "Not available" option citing the conflict —
 * the same honest-gap convention `LoopSafetyAnalysis.tsx`'s own "Risk
 * Classification" row already established for Conflict #1, not a
 * silently missing option. This Store owns the resolution because it
 * is the one place both pieces of information it needs — the selected
 * type and the portfolio's current debt balance (needed to convert a
 * repayment *amount* into a target *balance*) — are available
 * together, the same "compose at the Store layer, not the Service
 * layer" precedent `LoopScenarioSensitivity.tsx`'s own `runPreset`
 * establishes for Loop. Returns `null` when the type's own required
 * field has not been supplied yet (`targetInputs` is `null`, or its
 * one relevant field is `undefined`) — `runExitCalculation` treats
 * this as "not ready yet," the same no-op-until-ready convention
 * `runLoopStrategy` already uses for `settings === null`.
 *
 * **Infeasibility is mapped into `StrategyWarning[]`, not left buried
 * in `ExitPlanResult.infeasibleReason` alone.** `ExitPlanResult`
 * (`services/exit/plan.ts`, M3-011) already reports `feasible: false`
 * with a real, computed reason as data (never a thrown failure) — the
 * exact same "unsafe but well-formed" convention
 * `validateLoopStrategySafety` established for Loop, which
 * `loopBuilderStore.ts`'s own `toStrategyWarning` already maps into
 * `StrategyWarning[]` a batch before its own dedicated analysis task
 * (M7-013) existed. `toInfeasibleWarning`'s own `suggestedResponse` is
 * now type-specific (Batch 5, M7-027 "Implement Exit Feasibility
 * Analysis") — `EXIT_TYPE_SUGGESTED_ADJUSTMENT` replaces the one
 * generic Batch-4-era message with a real, per-type adjustment
 * suggestion, satisfying that task's own DoD ("Infeasible targets
 * return explicit reasons and possible adjustments") more precisely
 * than a single one-size-fits-all sentence could. `ExitFeasibilityAnalysis.tsx`
 * (also M7-027) is the richer, dedicated view this Store's own Batch 4
 * header comment already flagged as deferred here.
 *
 * **`runPriceSensitivity` (Batch 5, M7-028 "Implement Exit Price
 * Sensitivity") reuses `planExit` directly, called once per price
 * point with the *same* resolved target and a different
 * `scenarioBtcPriceUsd` override** — the exact mechanism M7-022's own
 * "Target BTC price" field already threads through `planExit`
 * (`calculateExitPosition`'s own optional price override), applied
 * repeatedly rather than composed through a second calculation path.
 * This is a more direct reuse than Loop's own equivalent
 * (`runSensitivityScenario`, which composes `simulateScenario` against
 * a *constructed* final-state portfolio, since Loop's own strategy
 * result has no native price-override input) — Exit's own Service
 * already accepts exactly this override natively. 4 points: "Current
 * Price" (the portfolio's own real market price, no override),
 * "User Target Price" (`targetInputs.scenarioBtcPriceUsd`, identical
 * to Current Price when the user has not set an override — an honest
 * reflection, not a gap), and a "Lower-Price Case"/"Higher-Price Case"
 * pair at ±20% — a documented, reasonable assumption (06_TASKS.md
 * names no concrete magnitude), the same "not derived from any
 * formula, clearly labeled" precedent `LoopPresets.tsx`'s own 3 preset
 * values already established. Each point's own `result.feasible` is
 * carried through unchanged — `healthFactor`/`retainedBtc` targets can
 * genuinely flip feasibility across price points (their own resolved
 * target debt is price-dependent inside `calculateTargetExit`), so
 * showing this per-point, not gating the whole feature on the *current*
 * price's own feasibility, is exactly what "Users can understand how
 * price uncertainty affects an exit plan" (M7-028's own DoD) asks for.
 *
 * **`saveExitPlan`/`loadExitPlan`/`duplicateExitPlan`/`deleteExitPlan`
 * (Batch 5, M7-029 "Implement Exit Plan Save and Load") mirror
 * `loopBuilderStore.ts`'s own `saveStrategy`/`loadStrategy`/
 * `duplicateStrategy`/`deleteStrategy` verbatim in shape** —
 * `crypto.randomUUID()` identity, `" (Copy)"` duplicate-naming
 * convention, Load restores already-computed values directly without
 * recalculating (preserving original assumptions). `SavedExitPlan`
 * gains `portfolioId`/`portfolioUpdatedAt` (the same drift-detection
 * snapshot `SavedLoopStrategy`/`SavedSimulation` already carry) and
 * `warnings`/`metadata` (frozen snapshots of this Store's own
 * ephemeral fields at save time) — extending the minimal Batch-4-era
 * shape (`{id, name, exitType, targetInputs, result, createdAt}`) the
 * same way `SavedLoopStrategy` was extended at the batch that actually
 * needed Save/Load. M7-029's own Store list also names "Assumptions" —
 * deliberately not stored as its own field, since it is fully
 * reconstructable from `targetInputs`/`exitType`/`portfolioId` at load
 * time via the already-shared `StrategyAssumptionsPanel` (M7-004), the
 * same "do not store what is already derivable" discipline
 * `loopBuilderStore.ts`'s own header comment already documents.
 * `selectedPlanId` (new this batch) mirrors `loopBuilderStore.ts`'s own
 * `selectedStrategyId`.
 */
export const EXIT_PLANNER_TYPES = [
  'fullExit',
  'partialDebtRepayment',
  'targetHealthFactor',
  'targetRetainedBtc',
  'targetDebtBalance',
] as const;

export type ExitPlannerType = (typeof EXIT_PLANNER_TYPES)[number];

/**
 * `scenarioBtcPriceUsd` is present on every type — mirrors
 * `calculateExitPosition`'s own optional price override, satisfying
 * M7-022's "Clearly distinguish target price from current price"
 * Requirement as an explicit field alongside whichever type-specific
 * target is set, not folded into it.
 */
export interface ExitPlannerTargetInputs {
  repaymentAmount?: number;
  targetHealthFactor?: number;
  targetRetainedBtc?: number;
  targetDebtBalance?: number;
  scenarioBtcPriceUsd?: number;
}

export interface PriceSensitivityPoint {
  label: string;
  priceUsd: number;
  result: ExitPlanResult;
}

export interface SavedExitPlan {
  id: string;
  name: string;
  portfolioId: string;
  portfolioUpdatedAt: string;
  exitType: ExitPlannerType;
  targetInputs: ExitPlannerTargetInputs;
  result: ExitPlanResult;
  warnings: StrategyWarning[];
  metadata: ServiceMetadata | null;
  createdAt: string;
}

export interface SaveExitPlanInput {
  name: string;
  portfolioId: string;
  portfolioUpdatedAt: string;
}

export type ExitPlannerStatus = 'idle' | 'calculating' | 'error';

export interface ExitPlannerStoreState {
  exitType: ExitPlannerType | null;
  targetInputs: ExitPlannerTargetInputs | null;
  currentResult: ExitPlanResult | null;
  status: ExitPlannerStatus;
  errors: ApplicationError[];
  warnings: StrategyWarning[];
  lastMetadata: ServiceMetadata | null;
  priceSensitivity: PriceSensitivityPoint[] | null;
  priceSensitivityErrors: ApplicationError[];
  savedPlans: SavedExitPlan[];
  selectedPlanId: string | null;
}

export interface ExitPlannerStoreActions {
  setExitType: (exitType: ExitPlannerType) => void;
  setTargetInputs: (inputs: ExitPlannerTargetInputs) => void;
  runExitCalculation: (portfolio: ApplicationPortfolio) => void;
  runPriceSensitivity: (portfolio: ApplicationPortfolio) => void;
  saveExitPlan: (input: SaveExitPlanInput) => string | null;
  loadExitPlan: (id: string) => void;
  duplicateExitPlan: (id: string) => string | null;
  deleteExitPlan: (id: string) => void;
  loadSavedPlans: () => Promise<void>;
  reset: () => void;
}

const SOURCE_STATUS = 'manual';
const PRICE_SENSITIVITY_DELTA = 0.2;

const INITIAL_STATE: ExitPlannerStoreState = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle',
  errors: [],
  warnings: [],
  lastMetadata: null,
  priceSensitivity: null,
  priceSensitivityErrors: [],
  savedPlans: [],
  selectedPlanId: null,
};

function resolveExitTarget(
  exitType: ExitPlannerType,
  targetInputs: ExitPlannerTargetInputs,
  currentDebt: number,
): ExitTarget | null {
  switch (exitType) {
    case 'fullExit':
      return { type: 'debtBalance', targetDebt: 0 };
    case 'partialDebtRepayment':
      if (targetInputs.repaymentAmount === undefined) return null;
      return { type: 'debtBalance', targetDebt: currentDebt - targetInputs.repaymentAmount };
    case 'targetDebtBalance':
      if (targetInputs.targetDebtBalance === undefined) return null;
      return { type: 'debtBalance', targetDebt: targetInputs.targetDebtBalance };
    case 'targetHealthFactor':
      if (targetInputs.targetHealthFactor === undefined) return null;
      return { type: 'healthFactor', targetHealthFactor: targetInputs.targetHealthFactor };
    case 'targetRetainedBtc':
      if (targetInputs.targetRetainedBtc === undefined) return null;
      return { type: 'retainedBtc', targetRetainedBtc: targetInputs.targetRetainedBtc };
  }
}

/**
 * Per-type adjustment suggestions — 06_TASKS.md M7-027's own DoD
 * ("Infeasible targets return explicit reasons and possible
 * adjustments"). Each is a reasonable, generic direction for that
 * type's own failure mode, not a computed recommendation — the real,
 * specific reason always comes from `infeasibleReason` itself
 * (`cause`, below), never fabricated here.
 */
const EXIT_TYPE_SUGGESTED_ADJUSTMENT: Record<ExitPlannerType, string> = {
  fullExit:
    'A full exit is infeasible only if the portfolio itself has invalid protocol parameters — review the portfolio configuration.',
  partialDebtRepayment:
    'Reduce the requested repayment amount so it no longer exceeds the current debt balance.',
  targetDebtBalance:
    "Choose a target debt balance between $0 and the portfolio's current debt balance.",
  targetHealthFactor:
    'Choose a less aggressive (lower) target Health Factor, or add collateral first.',
  targetRetainedBtc: 'Choose a larger retained BTC quantity, closer to the current holdings.',
};

/**
 * The `??` fallback below is type-system-required (`infeasibleReason` is
 * declared optional on both `TargetExitResult` and `ExitPlanResult`),
 * but not force-tested — `calculateTargetExit`'s own implementation
 * sets a real reason string on every `feasible: false` return it
 * produces (3 of 3 branches, confirmed by direct source inspection),
 * so this fallback is unreachable given the Engine's current behavior,
 * the same class of provably-unreachable-but-type-required fallback
 * `LoopStrategySummary.tsx`'s own pre-extraction `STOP_REASON_LABELS`
 * map already documented.
 */
function toInfeasibleWarning(
  exitType: ExitPlannerType,
  infeasibleReason: string | undefined,
): StrategyWarning {
  return {
    category: 'infeasibleStrategy',
    severity: 'error',
    cause: infeasibleReason ?? 'The requested exit target is not feasible.',
    suggestedResponse: EXIT_TYPE_SUGGESTED_ADJUSTMENT[exitType],
  };
}

export const useExitPlannerStore = create<ExitPlannerStoreState & ExitPlannerStoreActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    setExitType: (exitType) => {
      set({
        exitType,
        targetInputs: null,
        currentResult: null,
        warnings: [],
        errors: [],
        status: 'idle',
        lastMetadata: null,
        priceSensitivity: null,
        priceSensitivityErrors: [],
      });
    },

    setTargetInputs: (inputs) => {
      set({ targetInputs: inputs, priceSensitivity: null, priceSensitivityErrors: [] });
    },

    runExitCalculation: (portfolio) => {
      const { exitType, targetInputs } = get();
      if (exitType === null) return;

      const target = resolveExitTarget(exitType, targetInputs ?? {}, portfolio.debt.balance);
      if (target === null) return;

      set({ status: 'calculating' });
      const result = planExit(portfolio, target, SOURCE_STATUS, targetInputs?.scenarioBtcPriceUsd);

      if (!result.ok) {
        // `currentResult`/`lastMetadata`/`warnings` are deliberately left
        // untouched — M7-038 "Restore last valid result," the same fix
        // `stores/loopBuilderStore.ts`'s own `runLoopStrategy` applies.
        // `setTargetInputs` (below) already never touched `currentResult`
        // itself, so no companion fix is needed there the way
        // `loopBuilderStore.ts`'s own `setSettings` needed one.
        // `setExitType` deliberately still nulls `currentResult` — a
        // genuine semantic jump to a different exit type has no result
        // yet, unlike an incremental target-input edit.
        set({ status: 'error', errors: result.errors });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        currentResult: result.data,
        lastMetadata: result.metadata,
        warnings: result.data.feasible
          ? []
          : [toInfeasibleWarning(exitType, result.data.infeasibleReason)],
      });
    },

    runPriceSensitivity: (portfolio) => {
      const { exitType, targetInputs } = get();
      if (exitType === null) return;

      const target = resolveExitTarget(exitType, targetInputs ?? {}, portfolio.debt.balance);
      if (target === null) return;

      const currentPrice = portfolio.market.btcPriceUsd;
      const targetPrice = targetInputs?.scenarioBtcPriceUsd ?? currentPrice;
      const points: { label: string; priceUsd: number }[] = [
        { label: 'Current Price', priceUsd: currentPrice },
        { label: 'User Target Price', priceUsd: targetPrice },
        {
          label: 'Lower-Price Case (-20%)',
          priceUsd: currentPrice * (1 - PRICE_SENSITIVITY_DELTA),
        },
        {
          label: 'Higher-Price Case (+20%)',
          priceUsd: currentPrice * (1 + PRICE_SENSITIVITY_DELTA),
        },
      ];

      const results: PriceSensitivityPoint[] = [];
      for (const point of points) {
        const result = planExit(portfolio, target, SOURCE_STATUS, point.priceUsd);
        if (!result.ok) {
          set({ priceSensitivityErrors: result.errors, priceSensitivity: null });
          return;
        }
        results.push({ label: point.label, priceUsd: point.priceUsd, result: result.data });
      }

      set({ priceSensitivityErrors: [], priceSensitivity: results });
    },

    saveExitPlan: (input) => {
      const { exitType, targetInputs, currentResult, warnings, lastMetadata } = get();
      if (exitType === null || currentResult === null) return null;

      const saved: SavedExitPlan = {
        id: crypto.randomUUID(),
        name: input.name,
        portfolioId: input.portfolioId,
        portfolioUpdatedAt: input.portfolioUpdatedAt,
        exitType,
        // `targetInputs` is `null` at the Store-action level for a Full
        // Exit reached without the UI form's own mount-effect (which
        // always sets `{}` first, matching `runExitCalculation`'s own
        // `targetInputs ?? {}` convention) — saved as `{}`, never
        // rejected, since Full Exit genuinely needs no target inputs.
        targetInputs: targetInputs ?? {},
        result: currentResult,
        warnings,
        metadata: lastMetadata,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ savedPlans: [...state.savedPlans, saved] }));
      autoSaveCoordinator.schedule('exitPlan', saved.id, saved);
      return saved.id;
    },

    loadExitPlan: (id) => {
      const saved = get().savedPlans.find((plan) => plan.id === id);
      if (saved === undefined) return;

      set({
        exitType: saved.exitType,
        targetInputs: saved.targetInputs,
        currentResult: saved.result,
        warnings: saved.warnings,
        lastMetadata: saved.metadata,
        status: 'idle',
        errors: [],
        priceSensitivity: null,
        priceSensitivityErrors: [],
        selectedPlanId: saved.id,
      });
    },

    duplicateExitPlan: (id) => {
      const existing = get().savedPlans.find((saved) => saved.id === id);
      if (existing === undefined) return null;

      const duplicate: SavedExitPlan = {
        ...existing,
        id: crypto.randomUUID(),
        name: `${existing.name} (Copy)`,
        createdAt: new Date().toISOString(),
      };
      set((state) => ({ savedPlans: [...state.savedPlans, duplicate] }));
      autoSaveCoordinator.schedule('exitPlan', duplicate.id, duplicate);
      return duplicate.id;
    },

    deleteExitPlan: (id) => {
      autoSaveCoordinator.scheduleDelete('exitPlan', id);
      set((state) => ({
        savedPlans: state.savedPlans.filter((saved) => saved.id !== id),
        selectedPlanId: state.selectedPlanId === id ? null : state.selectedPlanId,
      }));
    },

    loadSavedPlans: async () => {
      await autoSaveCoordinator.flushAll();
      const result = await persistenceService.list<SavedExitPlan>('exitPlan');
      if (!result.ok) return;
      set({ savedPlans: result.data });
    },

    reset: () => {
      set(INITIAL_STATE);
    },
  }),
);

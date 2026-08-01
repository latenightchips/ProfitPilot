import { create } from 'zustand';

import {
  type ApplicationError,
  type ApplicationPortfolio,
  type ExitPlanResult,
  type ExitTarget,
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
 * to the `portfolio` value passed in.
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
 * is the one place both pieces of
 * information it needs — the selected type and the portfolio's current
 * debt balance (needed to convert a repayment *amount* into a target
 * *balance*) — are available together, the same "compose at the Store
 * layer, not the Service layer" precedent
 * `LoopScenarioSensitivity.tsx`'s own `runPreset` establishes for Loop.
 * Returns `null` when the type's own required field has not been
 * supplied yet (`targetInputs` is `null`, or its one relevant field is
 * `undefined`) — `runExitCalculation` treats this as "not ready yet,"
 * the same no-op-until-ready convention `runLoopStrategy` already uses
 * for `settings === null`.
 *
 * **Infeasibility is mapped into `StrategyWarning[]`, not left buried
 * in `ExitPlanResult.infeasibleReason` alone.** `ExitPlanResult`
 * (`services/exit/plan.ts`, M3-011) already reports `feasible: false`
 * with a real, computed reason as data (never a thrown failure) — the
 * exact same "unsafe but well-formed" convention
 * `validateLoopStrategySafety` established for Loop, which
 * `loopBuilderStore.ts`'s own `toStrategyWarning` already maps into
 * `StrategyWarning[]` a batch before its own dedicated analysis task
 * (M7-013) existed. Reusing the exact same discipline here: leaving
 * this genuinely available, already-computed reason completely
 * unsurfaced until M7-027 ("Implement Exit Feasibility Analysis",
 * Batch 5) would contradict this engagement's own "never let genuinely
 * available data sit unused" rule. `category: 'infeasibleStrategy'` is
 * not a new classification — `types/strategy.ts`'s own header comment
 * already reserves it for exactly this ("M7-027... declares an
 * explicit M7-005 dependency for exactly this reason"). M7-027 itself
 * remains free to build a richer, dedicated feasibility view later;
 * this is the same "one warning row now, full analysis later" scope
 * split Loop Builder already used.
 *
 * **`savedPlans` (`SavedExitPlan[]`) exists on this Store's state from
 * this batch, with no actions to populate it yet** — mirrors
 * `loopBuilderStore.ts`'s own Batch 2 precedent for
 * `savedStrategies`/`selectedStrategyId` (real fields since M7-007,
 * `saveStrategy`/`loadStrategy`/etc. only arriving at M7-017). M7-020's
 * own Store list names "Saved plans" explicitly; M7-029 ("Implement
 * Exit Plan Save and Load", Batch 5) is the task that adds the actions
 * to populate it — the field exists now so that later task only adds
 * behavior, not a Store shape change.
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

export interface SavedExitPlan {
  id: string;
  name: string;
  exitType: ExitPlannerType;
  targetInputs: ExitPlannerTargetInputs;
  result: ExitPlanResult;
  createdAt: string;
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
  savedPlans: SavedExitPlan[];
}

export interface ExitPlannerStoreActions {
  setExitType: (exitType: ExitPlannerType) => void;
  setTargetInputs: (inputs: ExitPlannerTargetInputs) => void;
  runExitCalculation: (portfolio: ApplicationPortfolio) => void;
  reset: () => void;
}

const SOURCE_STATUS = 'manual';

const INITIAL_STATE: ExitPlannerStoreState = {
  exitType: null,
  targetInputs: null,
  currentResult: null,
  status: 'idle',
  errors: [],
  warnings: [],
  lastMetadata: null,
  savedPlans: [],
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
function toInfeasibleWarning(infeasibleReason: string | undefined): StrategyWarning {
  return {
    category: 'infeasibleStrategy',
    severity: 'error',
    cause: infeasibleReason ?? 'The requested exit target is not feasible.',
    suggestedResponse:
      'Reduce the requested amount, choose a less aggressive target, or select a different exit type.',
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
      });
    },

    setTargetInputs: (inputs) => {
      set({ targetInputs: inputs });
    },

    runExitCalculation: (portfolio) => {
      const { exitType, targetInputs } = get();
      if (exitType === null) return;

      const target = resolveExitTarget(exitType, targetInputs ?? {}, portfolio.debt.balance);
      if (target === null) return;

      set({ status: 'calculating' });
      const result = planExit(portfolio, target, SOURCE_STATUS, targetInputs?.scenarioBtcPriceUsd);

      if (!result.ok) {
        set({
          status: 'error',
          errors: result.errors,
          currentResult: null,
          lastMetadata: null,
          warnings: [],
        });
        return;
      }

      set({
        status: 'idle',
        errors: [],
        currentResult: result.data,
        lastMetadata: result.metadata,
        warnings: result.data.feasible ? [] : [toInfeasibleWarning(result.data.infeasibleReason)],
      });
    },

    reset: () => {
      set(INITIAL_STATE);
    },
  }),
);

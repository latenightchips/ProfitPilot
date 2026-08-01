'use client';

import {
  EXIT_PLANNER_TYPES,
  type ExitPlannerType,
  useExitPlannerStore,
} from '@/stores/exitPlannerStore';

/**
 * Exit Type Selector — 06_TASKS.md M7-021 ("Implement Exit Type
 * Selection"). Dependencies: M7-020. Priority P0, Effort M. Description:
 * "Allow users to select an exit approach." Types: "Full exit, Partial
 * debt repayment, Target Health Factor, Target retained BTC, Target
 * debt balance, Target cash proceeds." Requirements: "Display only
 * fields relevant to the selected exit type." DoD: "Each documented
 * exit approach has a clear, validated input flow."
 *
 * **5 of the 6 named types are real, selectable buttons here — see
 * `stores/exitPlannerStore.ts`'s own header comment for the full
 * "Full exit"/"Partial debt repayment"/"Target debt balance" →
 * `debtBalance` collapsing reasoning.** "Target cash proceeds" is
 * rendered as a 6th, explicitly disabled option with a labeled "Not
 * available" reason citing Conflict #10 — the same honest-gap
 * convention `LoopSafetyAnalysis.tsx`'s own "Risk Classification" row
 * already established for Conflict #1, not a silently missing choice.
 *
 * **"Display only fields relevant to the selected exit type" is
 * satisfied by `ExitTargetForm.tsx`, not this component** — this
 * component's own job ends at recording *which* type is selected
 * (`setExitType`); the conditional field rendering itself lives in the
 * form, keyed by the Store's own `exitType`, the same one-task-one-
 * component split `LoopPresets.tsx`/`LoopStrategyControls.tsx` already
 * establish for Loop Builder (presets set the Store directly; the
 * controls form reads/reacts to it).
 */
const EXIT_TYPE_LABELS: Record<ExitPlannerType, string> = {
  fullExit: 'Full Exit',
  partialDebtRepayment: 'Partial Debt Repayment',
  targetHealthFactor: 'Target Health Factor',
  targetRetainedBtc: 'Target Retained BTC',
  targetDebtBalance: 'Target Debt Balance',
};

export function ExitTypeSelector() {
  const exitType = useExitPlannerStore((state) => state.exitType);
  const setExitType = useExitPlannerStore((state) => state.setExitType);

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-foreground">Exit Approach</h3>
      <div className="flex flex-col gap-2">
        {EXIT_PLANNER_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            aria-pressed={exitType === type}
            onClick={() => setExitType(type)}
            className={`rounded-md border px-3 py-2 text-left text-sm hover:bg-accent/40 ${
              exitType === type ? 'border-primary bg-accent/20' : 'border-border'
            }`}
          >
            {EXIT_TYPE_LABELS[type]}
          </button>
        ))}
        <div className="rounded-md border border-border px-3 py-2 text-left text-sm text-muted-foreground">
          <span className="font-medium">Target Cash Proceeds</span>
          <p className="mt-0.5 text-xs">
            Not available — an exit target defined by a specific cash amount has no unique,
            documented execution order (PROJECT_STATUS.md Conflict #10).
          </p>
        </div>
      </div>
    </div>
  );
}

'use client';

import { formatCurrency, formatHealthFactor } from '@/components/strategy/format';
import type { ApplicationPortfolio } from '@/services';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Exit Feasibility Analysis — 06_TASKS.md M7-027 ("Implement Exit
 * Feasibility Analysis"). Dependencies: M7-023, M7-005. Priority P0,
 * Effort M. Description: "Explain whether a requested exit target is
 * feasible." Check: "Available collateral, Debt obligations,
 * Transaction costs, Requested retained BTC, Requested proceeds, Target
 * Health Factor." DoD: "Infeasible targets return explicit reasons and
 * possible adjustments."
 *
 * **The richer, dedicated feasibility view `stores/exitPlannerStore.ts`'s
 * own Batch 4 header comment already flagged as deferred here** — Batch
 * 4 already mapped a real, computed infeasibility into one
 * `StrategyWarning` (rendered generically by the shared
 * `StrategyWarnings.tsx`); this component adds the "Check" list's own
 * dimensions and, per this task's DoD, "possible adjustments" — now a
 * real, type-specific suggestion (`EXIT_TYPE_SUGGESTED_ADJUSTMENT`,
 * enriched this same batch) rather than one generic sentence.
 *
 * **The Engine has no per-check breakdown to render, unlike Loop's own
 * `LoopSafetyFinding[]`.** `calculateTargetExit` returns exactly one
 * boolean (`feasible`) and one reason string — there is no `Yes`/`No`
 * per dimension to check off the way `LoopSafetyAnalysis.tsx` does for
 * Loop's own 6-value `LoopSafetyCheck` union. "Check" is satisfied
 * honestly instead by echoing the real *inputs* that feed the
 * feasibility determination (Available Collateral, Debt Obligations,
 * and whichever type-specific target value was requested) — not a
 * fabricated per-item pass/fail list the underlying data cannot
 * support.
 *
 * **"Requested proceeds" is excluded — Conflict #10, the same exclusion
 * `ExitTypeSelector.tsx`'s own "Target Cash Proceeds" option already
 * documents.** "Transaction costs" is disclosed as itemized-unavailable
 * (conflict #8) *and* explicitly noted as not factored into the
 * feasibility determination at all — an honest limitation, not a silent
 * omission: the Engine's own `calculateTargetExit` never subtracts an
 * (unknown) fee from the resolved target debt, so a target reported
 * feasible here could still be marginally infeasible once real
 * transaction costs are known.
 */
const EXIT_TYPE_LABELS: Record<string, string> = {
  fullExit: 'Full Exit',
  partialDebtRepayment: 'Partial Debt Repayment',
  targetHealthFactor: 'Target Health Factor',
  targetRetainedBtc: 'Target Retained BTC',
  targetDebtBalance: 'Target Debt Balance',
};

export function ExitFeasibilityAnalysis({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const exitType = useExitPlannerStore((state) => state.exitType);
  const targetInputs = useExitPlannerStore((state) => state.targetInputs);
  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const warnings = useExitPlannerStore((state) => state.warnings);

  if (exitType === null || currentResult === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure an exit target to see its feasibility analysis.
      </p>
    );
  }

  const infeasibleWarning = warnings.find((warning) => warning.category === 'infeasibleStrategy');

  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Feasible</span>
        <span
          className={`font-medium ${currentResult.feasible ? 'text-foreground' : 'text-destructive'}`}
        >
          {currentResult.feasible ? 'Yes' : 'No'}
        </span>
      </div>

      {infeasibleWarning !== undefined && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
          <p className="font-medium text-destructive">{infeasibleWarning.cause}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Possible adjustment: {infeasibleWarning.suggestedResponse}
          </p>
        </div>
      )}

      <div className="flex flex-col gap-1 border-t border-border pt-2">
        <span className="text-muted-foreground">Checked Against</span>
        <dl className="flex flex-col gap-0.5 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Available Collateral</dt>
            <dd className="text-foreground">
              {portfolio.collateral.quantity} BTC (
              {formatCurrency(currentResult.before.collateralValue)})
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Debt Obligations</dt>
            <dd className="text-foreground">{formatCurrency(currentResult.before.debtValue)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Exit Type</dt>
            <dd className="text-foreground">{EXIT_TYPE_LABELS[exitType]}</dd>
          </div>
          {targetInputs?.targetHealthFactor !== undefined && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Target Health Factor</dt>
              <dd className="text-foreground">
                {formatHealthFactor(targetInputs.targetHealthFactor)}
              </dd>
            </div>
          )}
          {targetInputs?.targetRetainedBtc !== undefined && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Requested Retained BTC</dt>
              <dd className="text-foreground">{targetInputs.targetRetainedBtc}</dd>
            </div>
          )}
        </dl>
      </div>

      <div className="flex items-center justify-between border-t border-border pt-2">
        <span className="text-muted-foreground">Transaction Costs</span>
        <span className="text-xs text-muted-foreground">
          Not factored into feasibility — no documented formula (Conflict #8).
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Requested Proceeds</span>
        <span className="text-xs text-muted-foreground">
          Not applicable — a distinct cash-proceeds target is not supported (Conflict #10).
        </span>
      </div>
    </div>
  );
}

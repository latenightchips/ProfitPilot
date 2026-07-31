import type { StrategyWarning, StrategyWarningCategory } from '@/types/strategy';

/**
 * Shared Strategy Warning System — 06_TASKS.md M7-005 ("Create Shared
 * Strategy Warning System"). Dependencies: M7-002. Priority P0, Effort
 * M. Categories: "Safety, Liquidation, Borrowing capacity, Interest
 * burden, Transaction cost, Stale data, Invalid target, Infeasible
 * strategy." Requirements: "Every warning includes a cause, severity,
 * and suggested response." DoD: "Loop and exit workflows present
 * warnings consistently."
 *
 * **Renders `StrategyWarning[]` generically — this batch does not
 * generate any real warnings.** No Loop Builder or Exit Planner Store
 * exists yet (both arrive later: M7-007 in Batch 2, M7-020 in Batch 4),
 * so there is no real Engine/Service finding to map into this shape
 * today. M7-013 ("Implement Loop Safety Analysis") and M7-027
 * ("Implement Exit Feasibility Analysis") both declare an explicit
 * dependency on this task for exactly this reason — they are where real
 * `LoopSafetyFinding[]`/exit-feasibility results actually get mapped
 * into `StrategyWarning[]` and passed to this component. This mirrors
 * `types/strategy.ts`'s own "shared foundation now, real wiring later"
 * scoping for `StrategyBaseline`/`StrategyComparisonResult`.
 *
 * **Severity uses the assertive/polite live-region split established
 * since Batch 13 (`DashboardErrorBanner`/`NoDebtNotice`, M5-021) and
 * reused throughout Milestones 5–6**: `'error'` warnings get
 * `role="alert"` (assertive — a blocking or strategy-invalidating
 * condition), `'warning'` warnings get `role="status"` (polite — a
 * non-blocking caution). This is the first shared component in this
 * codebase to need both severities on the same list at once, since
 * `SimulationWarnings.tsx` (M6-014) never modeled severity as a field.
 *
 * **A zero-warnings result renders positive confirmation text, not
 * nothing** — the same "always-visible section" convention every prior
 * warnings-style component in this codebase already follows
 * (`SimulationWarnings.tsx` and its own cited precedents).
 */
const CATEGORY_LABELS: Record<StrategyWarningCategory, string> = {
  safety: 'Safety',
  liquidation: 'Liquidation',
  borrowingCapacity: 'Borrowing Capacity',
  interestBurden: 'Interest Burden',
  transactionCost: 'Transaction Cost',
  staleData: 'Stale Data',
  invalidTarget: 'Invalid Target',
  infeasibleStrategy: 'Infeasible Strategy',
};

export function StrategyWarnings({ warnings }: { warnings: StrategyWarning[] }) {
  if (warnings.length === 0) {
    return <p className="text-sm text-muted-foreground">No warnings for this strategy.</p>;
  }

  return (
    <div className="flex flex-col gap-3 text-sm">
      {warnings.map((warning, index) => (
        <div
          key={`${warning.category}-${index}`}
          role={warning.severity === 'error' ? 'alert' : 'status'}
          className={
            warning.severity === 'error'
              ? 'flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/10 p-3'
              : 'flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3'
          }
        >
          <span className="text-xs font-medium text-foreground">
            {CATEGORY_LABELS[warning.category]}
          </span>
          <p className="text-foreground">{warning.cause}</p>
          <p className="text-muted-foreground">{warning.suggestedResponse}</p>
        </div>
      ))}
    </div>
  );
}

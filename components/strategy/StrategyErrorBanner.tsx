'use client';

import Link from 'next/link';

import type { ApplicationError } from '@/services';
import type { Portfolio } from '@/types/portfolio';
import { downloadPortfolioRecoveryCopy } from '@/utils/portfolioRecoveryExport';

/**
 * Shared Strategy Error Banner — 06_TASKS.md M7-038 ("Implement Strategy
 * Error Recovery"). Include: "Retry, Restore last valid result, Return
 * to portfolio, Edit assumptions, Export recovery copy where
 * applicable." DoD: "A failed strategy calculation never destroys valid
 * portfolio or saved-plan data."
 *
 * **One shared component for Loop Builder, Exit Planner, and
 * Recommendation Center** — the same `role="alert"`/error-message/
 * recovery-actions shape `DashboardErrorBanner.tsx` (M5-021) and
 * `ScenarioSummary.tsx`'s own error block (M6-026) already established,
 * factored out here since all three strategy tools need the identical
 * shape and none of them owned it individually.
 *
 * **No "Retry" button — the same reasoning `ScenarioSummary.tsx`'s own
 * header comment already documents for Simulation, and equally true
 * here.** Loop Builder/Exit Planner/Recommendation Center all
 * recalculate live off already-current inputs (debounced `onChange` in
 * Loop/Exit, portfolio-change `useEffect` in Recommendation Center) —
 * there is no stale "last submitted" request a Retry button would
 * usefully resubmit; the next input/portfolio change already re-runs
 * the calculation. A literal button here would be a redundant near-no-op
 * unlike `DashboardErrorBanner`'s own Retry (Dashboard's summary is
 * explicitly *not* live-recalculating, so a real "try that exact call
 * again" gesture exists there). `retryHint` states this plainly instead.
 *
 * **"Restore last valid result" is not this component's own job — it is
 * satisfied at the Store layer, one level up.** `stores/loopBuilderStore.ts`/
 * `stores/exitPlannerStore.ts`/`stores/recommendationCenterStore.ts` no
 * longer null `currentResult`/`actions` on a calculation failure (a real
 * behavior change made alongside this component, not a pre-existing
 * fact) — the previously-displayed valid result simply stays visible
 * underneath this banner, stale but real, rather than being replaced by
 * a blank "not configured" message. This banner only adds the missing
 * failure explanation on top of what was already true structurally
 * (Service calls are pure — see each Store's own header comment — so a
 * failure could never have destroyed the portfolio or a saved plan to
 * begin with).
 *
 * **"Edit assumptions"** needs no new affordance — the input controls
 * that produced the failing calculation (`LoopStrategyControls`,
 * `ExitTargetForm`) already render in a separate region of each route,
 * never hidden or disabled by this banner.
 *
 * **"Export recovery copy where applicable"** reuses
 * `downloadPortfolioRecoveryCopy` (M4-017) directly, exactly like
 * `DashboardErrorBanner.tsx` — the one thing guaranteed to exist and be
 * valid at failure time, since every Service call here is provably
 * pure. A real prior strategy/exit/recommendation result, when one
 * exists, remains separately exportable through each tool's own
 * existing Export component (`LoopStrategyExport`/`ExitPlanExport`),
 * which already gates on `currentResult !== null` — now correctly
 * reachable during a failure too, since the Store no longer nulls it.
 */
export function StrategyErrorBanner({
  errors,
  portfolio,
  retryHint,
}: {
  errors: ApplicationError[];
  portfolio: Portfolio;
  retryHint: string;
}) {
  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <p className="font-medium text-destructive">Unable to calculate this result.</p>
      {errors.map((error) => (
        <div key={error.code} className="mt-1">
          <p className="text-destructive">{error.message}</p>
          <p className="text-xs text-muted-foreground">Error code: {error.code}</p>
        </div>
      ))}
      <p className="mt-2 text-xs text-muted-foreground">
        Your portfolio data is unchanged. {retryHint}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href="/portfolio"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Return to Portfolio to fix the underlying data
        </Link>
        <button
          type="button"
          onClick={() => downloadPortfolioRecoveryCopy(portfolio)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Download recovery copy
        </button>
      </div>
    </div>
  );
}

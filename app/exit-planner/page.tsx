'use client';

import Link from 'next/link';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import { StrategyWarnings } from '@/components/strategy/StrategyWarnings';
import {
  ExitFeasibilityAnalysis,
  ExitPlanExport,
  ExitPlanLibrary,
  ExitPriceSensitivity,
  ExitTargetForm,
  ExitTypeSelector,
  FullExitResult,
  PartialExitResult,
  SaveExitPlanForm,
  TargetHealthFactorResult,
} from '@/features/exit-planner';
import { useExitPlannerStore } from '@/stores/exitPlannerStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Exit Planner Route — 06_TASKS.md M7-019 ("Create Exit Planner
 * Route"). Dependencies: M7-001. Priority P0, Effort S. Include: "Exit
 * target controls, Current portfolio baseline, Exit result, Debt
 * repayment breakdown, Retained BTC, Cash proceeds, Warnings." DoD:
 * "Users can access the Exit Planner from the Dashboard and strategy
 * navigation."
 *
 * **"Users can access the Exit Planner from the Dashboard and strategy
 * navigation" is already satisfied** — see this route's own Batch 4
 * note (unchanged): `buildQuickActions.ts`'s own Exit Planner Quick
 * Action, `AppSidebar`'s persistent link.
 *
 * **All 7 named Include items now have real content.** "Exit result,"
 * "Debt repayment breakdown," "Retained BTC," and "Cash proceeds" were
 * one explicit, labeled placeholder section through Batch 4; Milestone
 * 7 Batch 5 (M7-024/M7-025/M7-026) replaces it with 3 real, independently-
 * gated components — see each one's own header comment for exactly
 * which fields it covers and why.
 *
 * **`FullExitResult`/`PartialExitResult` are mutually exclusive, chosen
 * by the *result* (`after.debtValue === 0`), not by which of the 5
 * exit types was selected — see `FullExitResult.tsx`'s own header
 * comment.** This route owns the shared "not configured yet"/
 * "infeasible" messaging once, below, rather than duplicating it
 * inside both components — a deliberate deviation from
 * `app/loop-builder/page.tsx`'s own per-component-independence
 * precedent (Loop's own Safety/Cost/Sensitivity sections are shown
 * *simultaneously* and independently; Full/Partial Exit Result are
 * alternative views of the *same* single result, so a single shared
 * gate avoids showing two different "nothing to show" messages side by
 * side for one calculation). `TargetHealthFactorResult` renders
 * additionally, only for that one type, alongside whichever of
 * Full/Partial also applies.
 *
 * **Milestone 7 Batch 5 adds 5 more sections** (M7-027 Feasibility
 * Analysis, M7-028 Price Sensitivity, M7-029 Save/Load, M7-030 Export)
 * — none named in M7-019's own original 7-item Include list, the same
 * "surface genuinely available functionality from its own dedicated
 * task, placed on this same route since it is the one place an exit
 * plan result is ever shown" reasoning `app/loop-builder/page.tsx`
 * already established for its own later-added Batch 3 sections.
 */
export default function ExitPlannerPage() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const lastMetadata = useExitPlannerStore((state) => state.lastMetadata);
  const warnings = useExitPlannerStore((state) => state.warnings);
  const currentResult = useExitPlannerStore((state) => state.currentResult);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Exit Planner</h1>
        <p className="text-sm text-muted-foreground">&ldquo;What should I do now?&rdquo;</p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>{' '}
          to plan an exit.
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside
            aria-label="Exit Target Controls"
            className="flex flex-col gap-4 rounded-md border border-border p-4 lg:w-80 lg:shrink-0"
          >
            <ExitTypeSelector />
            <div className="border-t border-border pt-4">
              <ExitTargetForm portfolio={record.portfolio} />
            </div>
          </aside>

          <div className="flex flex-1 flex-col gap-6">
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Current Portfolio Baseline</h2>
              <StrategyAssumptionsPanel
                portfolio={record.portfolio}
                metadata={lastMetadata}
                timeHorizonLabel={null}
              />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Exit Result</h2>
              {currentResult === null ? (
                <p className="text-sm text-muted-foreground">
                  Configure an exit target to see the result.
                </p>
              ) : !currentResult.feasible ? (
                <p className="text-sm text-muted-foreground">
                  This target is not feasible — see Warnings below.
                </p>
              ) : (
                <>
                  <FullExitResult />
                  <PartialExitResult />
                  <TargetHealthFactorResult />
                </>
              )}
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Feasibility Analysis</h2>
              <ExitFeasibilityAnalysis portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Price Sensitivity</h2>
              <ExitPriceSensitivity portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Warnings</h2>
              <StrategyWarnings warnings={warnings} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Save Plan</h2>
              <SaveExitPlanForm
                portfolioId={record.portfolio.id}
                portfolioUpdatedAt={record.portfolio.updatedAt}
              />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Saved Exit Plans</h2>
              <ExitPlanLibrary portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Export Plan</h2>
              <ExitPlanExport portfolio={record.portfolio} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

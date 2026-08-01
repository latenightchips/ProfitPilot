'use client';

import Link from 'next/link';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import { StrategyWarnings } from '@/components/strategy/StrategyWarnings';
import { ExitTargetForm, ExitTypeSelector } from '@/features/exit-planner';
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
 * navigation" is already satisfied** — the same two precedents
 * `app/loop-builder/page.tsx`'s own header comment already documents
 * for the identically-shaped M7-006 DoD clause:
 * `features/dashboard/utils/buildQuickActions.ts`'s own Exit Planner
 * Quick Action already links to `/exit-planner`, and `AppSidebar`'s
 * persistent "Exit Planner" link (M1-006, `constants/navigation.ts`) is
 * reachable from every route. No Dashboard or navigation component was
 * touched by this batch.
 *
 * **Now a client component**, replacing the M1-006 `PlaceholderPage` —
 * the same first-real-content transition `app/loop-builder/page.tsx`'s
 * own header comment documents for M7-006. Gated on an active
 * portfolio, the same "no portfolio, no strategy to build" reasoning —
 * an exit needs a real starting position to exit from.
 *
 * **Of the 7 named Include items, 3 have real content this batch (Exit
 * target controls, Current portfolio baseline, Warnings); 4 remain one
 * explicit, labeled placeholder section (Exit result, Debt repayment
 * breakdown, Retained BTC, Cash proceeds) citing M7-024 ("Implement
 * Full Exit Result") and M7-025 ("Implement Partial Exit Result",
 * Batch 5) — their own dedicated, later tasks.** This mirrors
 * `app/loop-builder/page.tsx`'s own M7-006-era Safety/Cost Analysis
 * placeholders exactly, not a new pattern; the 4 items are grouped into
 * one section rather than four, since all four are facets of the same
 * not-yet-built result display (`ExitPlanResult.transaction`'s own
 * `repayment`/`btcSold`/`btcRetained` fields), not four separate
 * components. **"Warnings" is rendered even though M7-019 does not name
 * a Requirements/DoD text of its own for it** — `stores/exitPlannerStore.ts`
 * (M7-020) already maps a real, computed infeasibility reason into
 * `StrategyWarning[]` this same batch, and leaving it completely
 * unsurfaced would contradict this engagement's own "never let
 * genuinely available data sit unused" discipline, the same reasoning
 * `app/loop-builder/page.tsx`'s own Batch 2 "Warnings" section already
 * applied for Loop.
 *
 * **"Exit target controls" is two components, not one** — `ExitTypeSelector`
 * (M7-021) and `ExitTargetForm` (M7-022), the same one-task-one-component
 * split `LoopPresets.tsx`/`LoopStrategyControls.tsx` already establish.
 */
export default function ExitPlannerPage() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const lastMetadata = useExitPlannerStore((state) => state.lastMetadata);
  const warnings = useExitPlannerStore((state) => state.warnings);

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
              <p className="text-sm text-muted-foreground">
                Not yet implemented — see M7-024 (&ldquo;Implement Full Exit Result&rdquo;) and
                M7-025 (&ldquo;Implement Partial Exit Result&rdquo;).
              </p>
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Warnings</h2>
              <StrategyWarnings warnings={warnings} />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

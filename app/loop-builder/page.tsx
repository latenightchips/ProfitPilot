'use client';

import Link from 'next/link';

import { StrategyAssumptionsPanel } from '@/components/strategy/StrategyAssumptionsPanel';
import { StrategyWarnings } from '@/components/strategy/StrategyWarnings';
import {
  LoopPresets,
  LoopStepTable,
  LoopStrategyControls,
  LoopStrategySummary,
} from '@/features/loop-builder';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Loop Builder Route — 06_TASKS.md M7-006 ("Create Loop Builder Route").
 * Dependencies: M7-001. Priority P0, Effort S. Include: "Strategy
 * controls, Current portfolio baseline, Results summary, Loop steps,
 * Safety analysis, Cost analysis." DoD: "Users can open the Loop
 * Builder from the Dashboard and Simulation Workspace."
 *
 * **"Users can open the Loop Builder from the Dashboard" is already
 * satisfied** — `features/dashboard/utils/buildQuickActions.ts`'s own
 * "Build loop strategy" Quick Action (M5-016) already links here. "...and
 * Simulation Workspace" is satisfied the same way `app/simulation/page.tsx`'s
 * own header comment already resolved the identical-shaped M6-001 DoD
 * clause for Dashboard→Simulation: `AppSidebar`'s persistent "Loop
 * Builder" link (M1-006) is reachable from every route, including
 * Simulation Workspace, without a new in-page link — the same accepted
 * precedent, not a new one invented here. No Simulation Workspace
 * component was touched by this batch.
 *
 * **Now a client component**, replacing the M1-006 `PlaceholderPage` —
 * the same first-real-content transition `app/simulation/page.tsx`'s
 * own header comment documents for M6-004. Gated on an active
 * portfolio, the same "no portfolio, no strategy to build" reasoning
 * `app/simulation/page.tsx` already established (a loop strategy needs
 * a real starting position to loop from).
 *
 * **Of the 6 named Include items, 4 have real content this batch
 * (Strategy controls, Current portfolio baseline, Results summary, Loop
 * steps); 2 remain explicit, labeled placeholders (Safety analysis,
 * Cost analysis) — their own dedicated, later Batch 3 tasks (M7-013,
 * M7-014).** This mirrors `app/simulation/page.tsx`'s own M6-001-era
 * placeholders exactly, not a new pattern. **"Warnings" is not one of
 * M7-006's own 6 named Include items, but is rendered anyway** — this
 * batch's own Store (`stores/loopBuilderStore.ts`, M7-007) already
 * generates real `StrategyWarning[]` from the Service's own safety
 * findings, and leaving real, already-computed safety information
 * completely unsurfaced until Batch 3 would contradict this
 * engagement's own "never let genuinely available data sit unused"
 * discipline (the same reasoning `ScenarioSummary.tsx`'s own Batch 9
 * "Warnings" section already applied for Simulation, a section M6-009
 * itself didn't name either).
 */
export default function LoopBuilderPage() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const lastMetadata = useLoopBuilderStore((state) => state.lastMetadata);
  const warnings = useLoopBuilderStore((state) => state.warnings);
  const settings = useLoopBuilderStore((state) => state.settings);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Loop Builder</h1>
        <p className="text-sm text-muted-foreground">
          &ldquo;How much leverage should I use?&rdquo;
        </p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>{' '}
          to build a loop strategy.
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside
            aria-label="Strategy Controls"
            className="flex flex-col gap-4 rounded-md border border-border p-4 lg:w-80 lg:shrink-0"
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-medium text-foreground">Strategy Controls</h2>
              <LoopStrategyControls portfolio={record.portfolio} />
            </div>
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <LoopPresets
                portfolio={record.portfolio}
                maxLoanToValue={
                  settings?.maxLoanToValueOverride ?? record.portfolio.protocol.maxLoanToValue
                }
                borrowRateAssumption={
                  settings?.borrowAprOverride ?? record.portfolio.protocol.borrowApr
                }
              />
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
              <h2 className="text-sm font-medium text-foreground">Results Summary</h2>
              <LoopStrategySummary portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Loop Steps</h2>
              <LoopStepTable />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Warnings</h2>
              <StrategyWarnings warnings={warnings} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Safety Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Not yet implemented — see M7-013 (&ldquo;Implement Loop Safety Analysis&rdquo;).
              </p>
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Cost Analysis</h2>
              <p className="text-sm text-muted-foreground">
                Not yet implemented — see M7-014 (&ldquo;Implement Loop Cost Analysis&rdquo;).
              </p>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

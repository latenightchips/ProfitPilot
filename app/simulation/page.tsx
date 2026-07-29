'use client';

import Link from 'next/link';

import {
  ScenarioBuilder,
  ScenarioCharts,
  ScenarioComparison,
  ScenarioSummary,
  ScenarioTimeline,
  SimulationAssumptions,
} from '@/features/simulation';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace") + M6-004 ("Create Scenario Builder") + M6-009 ("Implement
 * Scenario Summary") + M6-010 ("Implement Scenario Comparison") +
 * M6-011 ("Implement Scenario Charts", Batch 10).
 *
 * **Now a client component** — the Scenario Builder (M6-004, Batch 3)
 * needs the active portfolio from `usePortfolioStore` to validate and
 * simulate against, the first Simulation-route content with real data
 * dependencies. `AppSidebar`'s own "Simulation" link (M1-006) still
 * satisfies M6-001's own DoD ("Users can access the Simulation
 * Workspace from the Dashboard") unchanged.
 *
 * **"Simulation sidebar" and "Scenario editor" remain read as the same
 * region** (M6-001's own header comment) — the `<aside>` below is that
 * one consolidated landmark; `ScenarioBuilder` renders inside it without
 * its own duplicate `aria-label`.
 *
 * **No active portfolio → the Scenario Builder cannot render.** A
 * scenario is meaningless without a real portfolio to validate deltas
 * against (collateral/debt withdrawal limits, the protocol's own
 * `maxLoanToValue`) or simulate a price change against — the same
 * "no active portfolio" gate `app/page.tsx` (Dashboard) already
 * establishes, reused here rather than inventing a second pattern.
 *
 * **Both M6-001 placeholders are gone.** "Simulation Results" renders
 * `ScenarioSummary` (Batch 8), immediately followed by "Simulation
 * Assumptions" rendering `SimulationAssumptions` (M6-013, Batch 12) —
 * placed directly after Results per `01_PRD.md`'s own Principle Two
 * ("Every displayed number must have a documented origin"), answering
 * "what was assumed" right next to "what was calculated." "Portfolio
 * Comparison" renders `ScenarioComparison` (M6-010, Batch 9), followed
 * by "Scenario Charts" rendering `ScenarioCharts` (M6-011, Batch 10),
 * followed by "Scenario Timeline" rendering `ScenarioTimeline` (M6-012,
 * Batch 11) — see each component's own header comment for its full
 * field-mapping/gap reasoning.
 */
export default function SimulationPage() {
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Simulation</h1>
        <p className="text-sm text-muted-foreground">&ldquo;What happens if...?&rdquo;</p>
      </div>

      {activePortfolioId === null || record === undefined ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>{' '}
          to build a scenario.
        </p>
      ) : (
        <div className="flex flex-col gap-6 lg:flex-row">
          <aside
            aria-label="Scenario Controls"
            className="flex flex-col gap-2 rounded-md border border-border p-4 lg:w-80 lg:shrink-0"
          >
            <h2 className="text-sm font-medium text-foreground">Scenario Controls</h2>
            <ScenarioBuilder portfolio={record.portfolio} />
          </aside>

          <div className="flex flex-1 flex-col gap-6">
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Simulation Results</h2>
              <ScenarioSummary />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Simulation Assumptions</h2>
              <SimulationAssumptions portfolio={record.portfolio} />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Portfolio Comparison</h2>
              <ScenarioComparison />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Scenario Charts</h2>
              <ScenarioCharts />
            </section>
            <section className="flex flex-col gap-2 rounded-md border border-border p-4">
              <h2 className="text-sm font-medium text-foreground">Scenario Timeline</h2>
              <ScenarioTimeline />
            </section>
          </div>
        </div>
      )}
    </div>
  );
}

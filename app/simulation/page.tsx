'use client';

import Link from 'next/link';

import { ScenarioBuilder } from '@/features/simulation';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace") + M6-004 ("Create Scenario Builder", this batch).
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
 * **Results area and Portfolio Comparison remain the M6-001 placeholder
 * this batch.** M6-004's own DoD is "Scenario inputs are validated
 * before calculation" — about the form, not about displaying results.
 * `runSimulation` (Store, M6-003) is wired and does populate
 * `currentResult` for a valid BTC Price change, but rendering it is
 * M6-009's ("Implement Scenario Summary") own later, dedicated task —
 * see `ScenarioBuilder.tsx`'s own header comment for the full scoping
 * reasoning.
 */
function WorkspaceSection({ title, note }: { title: string; note: string }) {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-border p-4">
      <h2 className="text-sm font-medium text-foreground">{title}</h2>
      <p className="text-sm text-muted-foreground">{note}</p>
    </section>
  );
}

const NOT_YET_BUILT = 'Implemented in a later Milestone 6 batch — see PROJECT_STATUS.md.';

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
            <WorkspaceSection title="Simulation Results" note={NOT_YET_BUILT} />
            <WorkspaceSection title="Portfolio Comparison" note={NOT_YET_BUILT} />
          </div>
        </div>
      )}
    </div>
  );
}

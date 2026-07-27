/**
 * Simulation Workspace Route — 06_TASKS.md M6-001 ("Create Simulation
 * Workspace"). Dependencies: M5-028. DoD: "Users can access the
 * Simulation Workspace from the Dashboard."
 *
 * Replaces the Milestone 1 `PlaceholderPage` scaffold with this task's
 * own named regions — Simulation sidebar (Scenario Controls), Scenario
 * editor, Results area, Comparison area — per its own "Include" list.
 * `AppSidebar`'s own "Simulation" link (M1-006) already navigates here
 * from every route including the Dashboard, satisfying this task's DoD
 * without any change to that shared, already-working navigation.
 *
 * **Structure only, no business logic** — the same "no business logic"
 * baseline `PlaceholderPage` itself already documented for this exact
 * route, now narrowed to real, named regions instead of one generic
 * placeholder paragraph. `features/simulation/` (M6-002, this same
 * batch) does not exist as an importable module with real content yet;
 * the Simulation Store (M6-003), Scenario Builder (M6-004), and every
 * calculation-driven region are later, still-unbuilt tasks — this file
 * intentionally imports nothing from `@/features/simulation` or
 * `@/stores` yet, matching the "Simulation Foundation" step's own
 * position first in this milestone's IMPLEMENTATION ORDER, before
 * "Scenario Builder."
 *
 * **"Simulation sidebar" and "Scenario editor" are read as the same
 * region** (a persistent controls panel, positioned as a sidebar on
 * wide screens), not two separate ones — `03_UI.md`'s own Page 5
 * ("Simulation Workspace") "PAGE LAYOUT" names a single "Scenario
 * Controls" section with no separate "sidebar" region anywhere in its
 * five-section layout, and its own "DESIGN RULES" ("Inputs remain
 * grouped together") supports one consolidated controls region rather
 * than inventing a second, undocumented one.
 *
 * **Quick Actions' own "Run simulation" link (`features/dashboard`,
 * M5-016) is deliberately left disabled by this batch** — it will show
 * only these three empty, not-yet-functional regions today. Re-enabling
 * it is deferred to whichever later Milestone 6 batch first gives this
 * route genuine simulation capability (M6-004/M6-005, the Scenario
 * Builder and Price Simulation), not this purely structural task.
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
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Simulation</h1>
        <p className="text-sm text-muted-foreground">&ldquo;What happens if...?&rdquo;</p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside
          aria-label="Scenario Controls"
          className="flex flex-col gap-2 rounded-md border border-border p-4 lg:w-80 lg:shrink-0"
        >
          <h2 className="text-sm font-medium text-foreground">Scenario Controls</h2>
          <p className="text-sm text-muted-foreground">{NOT_YET_BUILT}</p>
        </aside>

        <div className="flex flex-1 flex-col gap-6">
          <WorkspaceSection title="Simulation Results" note={NOT_YET_BUILT} />
          <WorkspaceSection title="Portfolio Comparison" note={NOT_YET_BUILT} />
        </div>
      </div>
    </div>
  );
}

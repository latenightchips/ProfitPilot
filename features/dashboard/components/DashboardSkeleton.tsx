/**
 * Dashboard Skeleton — 06_TASKS.md M5-019 ("Implement Dashboard Loading
 * States"). Dependencies: M5-005. DoD: "The Dashboard remains visually
 * stable while data loads."
 *
 * **Reachability**: `stores/portfolioStore.ts`'s own `load()` action
 * (M5-001) transitions `loadStatus` `'loading'` → `'idle'` synchronously
 * — there is no persistence layer to actually await yet (Conflict B), so
 * this state is real but typically imperceptible in a live browser,
 * exactly like `saveStatus`'s own `'saving'` transition. It exists now so
 * Milestone 8's real persistence layer only has to make the transition
 * observably slower, not build a new loading UI from scratch.
 *
 * **Renders unconditionally, replacing the rest of the page body while
 * `loadStatus === 'loading'`** (`app/page.tsx`) — previously a bare
 * "Loading…" paragraph rendered *alongside* whatever the no-portfolio/
 * portfolio branch below it produced, which is exactly the kind of
 * simultaneous, contradictory content this task's own "Avoid layout
 * shifts" Requirement warns against. Restructured so only one branch
 * renders at a time.
 *
 * **"Do not display misleading placeholder values"**: every block below
 * is an unlabeled, valueless `animate-pulse` bar — no fabricated numbers,
 * currency symbols, or portfolio name. `KpiCard`'s own `loading` prop
 * (added M5-005, unused until now) already establishes the same
 * `bg-accent/40` shimmer color reused here for visual consistency; the
 * KPI skeleton row reuses `KpiCard` directly rather than a second,
 * differently-styled placeholder.
 *
 * **Four named blocks, matching this task's own Include list literally**:
 * Summary skeleton (mirrors `DashboardSummaryHeader`'s two-line shape),
 * KPI skeletons (8 cards, matching `DashboardKpiGrid`'s own fixed card
 * count — via real `KpiCard` instances, not a duplicate hand-rolled grid),
 * Table skeleton (mirrors `PortfolioCompositionSection`'s own table
 * shape — the only Dashboard section that renders an actual `<table>`),
 * Recommendation skeleton (mirrors `RecommendationSummarySection`'s
 * bordered-list shape).
 */
import { KpiCard } from './KpiCard';

function Bar({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-accent/40 ${className}`} aria-hidden="true" />;
}

function SummarySkeleton() {
  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <Bar className="h-5 w-48" />
      <Bar className="h-3 w-64" />
    </div>
  );
}

function KpiSkeletons() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <KpiCard key={i} title="" primaryValue="" loading />
      ))}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <Bar className="h-4 w-40" />
      <Bar className="h-24 w-full" />
    </div>
  );
}

function RecommendationSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <Bar className="h-4 w-32" />
      <Bar className="h-16 w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading Dashboard">
      <SummarySkeleton />
      <KpiSkeletons />
      <TableSkeleton />
      <RecommendationSkeleton />
    </div>
  );
}

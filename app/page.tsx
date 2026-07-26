'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { buildDashboardViewModel } from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Route — 06_TASKS.md M5-001 ("Create Dashboard Route").
 * Dependencies: M4-010. DoD: "The Dashboard route renders safely for
 * every portfolio state." Replaces the Milestone 1 `PlaceholderPage` at
 * `/` (03_UI.md: the Dashboard is the default landing page, answering
 * "Am I safe?" among its five objective questions).
 *
 * **Batch scope — Dashboard Foundation only (M5-001–M5-003), per
 * 06_TASKS.md's own "IMPLEMENTATION ORDER"**: "Dashboard Foundation →
 * Summary Header → KPI Metrics → Risk Sections → Portfolio Composition →
 * Recommendations → Responsive and Accessible States → Testing." This
 * batch renders every documented portfolio state for real (no
 * placeholder text) using `buildDashboardViewModel` (M5-003), but the
 * actual Summary Header (M5-004), Shared KPI Card component (M5-005) and
 * Core KPI Grid (M5-006), Health Factor/Liquidation Risk sections
 * (M5-007–M5-010), Portfolio Composition (M5-011), Recommendation Summary
 * (M5-015), and full Dashboard Error Recovery (M5-021) are each later,
 * separate, dependency-gated tasks — not built here. The metrics list
 * below is a plain, real (live-data) list proving the
 * Store → Service → View Model → render pipeline end-to-end, not a
 * preview of the eventual KPI grid's visual design.
 *
 * **Loading state**: calls `load()` on mount, mirroring
 * `app/portfolios/page.tsx`'s own M4-004 pattern exactly. Per Conflict B
 * (no persistence before Milestone 8), `loadStatus` transitions
 * `'loading'` → `'idle'` synchronously with nothing to load — the
 * `'loading'` branch below is real and reachable via a direct Zustand
 * `subscribe` (same caveat already documented for `saveStatus`'s
 * `'saving'` in `stores/portfolioStore.ts`), not fabricated latency.
 *
 * **No-portfolio state**: "Redirect or guide users when no portfolio
 * exists" — guides, matching `app/portfolio/page.tsx`'s own established
 * choice ("No portfolio is currently selected." + a link), not a hard
 * redirect. Consistency across both routes for the same underlying
 * condition, not a new decision.
 *
 * **Error state**: `buildDashboardViewModel` can return `{ ok: false }`
 * (`calculatePortfolioSummary` genuinely fails for certain Zod-valid
 * inputs — confirmed via M4-017's own investigation, e.g. zero collateral
 * with nonzero debt). Rendered here as a minimal, honest message with a
 * link back to `/portfolio` to fix the underlying data — not the full
 * "Retry calculation / Retry refresh / Use last valid data / Export
 * recovery copy" flow M5-021 ("Implement Dashboard Error Recovery") is
 * separately responsible for building.
 *
 * **"Portfolio Status" / "Risk Category" (03_UI.md's Market Snapshot and
 * Health & Risk mockups) are not rendered** — blocked on Conflict #1
 * (Health Factor risk-band thresholds disagree across four documents);
 * see `features/dashboard/types/viewModel.ts` for the full reasoning.
 */
export default function DashboardPage() {
  const load = usePortfolioStore((state) => state.load);
  const loadStatus = usePortfolioStore((state) => state.loadStatus);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );

  useEffect(() => {
    load();
  }, [load]);

  const viewModel =
    record !== undefined ? buildDashboardViewModel(record.portfolio, record.summary) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">&ldquo;Am I safe?&rdquo;</p>
      </div>

      {loadStatus === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading…
        </p>
      )}

      {activePortfolioId === null || record === undefined || viewModel === null ? (
        <p className="text-sm text-muted-foreground">
          No portfolio is currently selected.{' '}
          <Link href="/portfolios" className="underline">
            Select or create one
          </Link>
          .
        </p>
      ) : viewModel.ok === false ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <p className="font-medium text-destructive">
            Unable to calculate a summary for {viewModel.portfolioName}.
          </p>
          {viewModel.errors.map((error) => (
            <p key={error.code} className="mt-1 text-destructive">
              {error.message}
            </p>
          ))}
          <Link href="/portfolio" className="mt-2 inline-block underline">
            Return to Portfolio to fix the underlying data
          </Link>
        </div>
      ) : (
        <div key={activePortfolioId} className="flex flex-col gap-4">
          <h2 className="text-lg font-medium text-foreground">{viewModel.portfolioName}</h2>
          <p className="text-xs text-muted-foreground">
            Calculated {viewModel.formattedCalculationTimestamp}
          </p>

          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(viewModel.metrics).map((item) => (
              <div key={item.label} className="flex flex-col">
                <dt className="text-xs text-muted-foreground">{item.label}</dt>
                <dd className="text-base font-medium text-foreground">{item.formattedValue}</dd>
              </div>
            ))}
          </dl>

          {viewModel.warnings.length > 0 && (
            <div className="rounded-md border border-border bg-accent/20 p-3 text-sm">
              {viewModel.warnings.map((warning) => (
                <p key={warning.code} className="text-muted-foreground">
                  {warning.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import {
  buildDashboardViewModel,
  buildHealthFactorStatus,
  buildLiquidationRiskPanel,
  DashboardKpiGrid,
  DashboardSummaryHeader,
  HealthFactorStatusSection,
  LiquidationRiskPanel,
} from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Route — 06_TASKS.md M5-001 ("Create Dashboard Route").
 * Dependencies: M4-010. DoD: "The Dashboard route renders safely for
 * every portfolio state." Replaces the Milestone 1 `PlaceholderPage` at
 * `/` (03_UI.md: the Dashboard is the default landing page, answering
 * "Am I safe?" among its five objective questions).
 *
 * **Batch scope — Dashboard Foundation (M5-001–M5-003, Batch 1) +
 * Summary Header (M5-004, Batch 2) + KPI Metrics (M5-005, M5-006,
 * Batch 3) + Risk Sections (M5-007, M5-009, Batch 4), per
 * 06_TASKS.md's own "IMPLEMENTATION ORDER"**: "Dashboard Foundation →
 * Summary Header → KPI Metrics → Risk Sections → Portfolio Composition →
 * Recommendations → Responsive and Accessible States → Testing."
 * `HealthFactorStatusSection` (M5-007) and `LiquidationRiskPanel`
 * (M5-009) are this batch's addition. M5-008 (Health Factor Range
 * Visualization) and M5-010 (Risk Warning Banner) — the remaining two
 * "Risk Sections" tasks — are deliberately not built this batch: M5-008
 * is wholly about the same Critical/Caution/Target zone boundaries
 * Conflict #1 blocks, and M5-010 needs further threshold research beyond
 * what this batch resolved (see PROJECT_STATUS.md). Portfolio
 * Composition (M5-011), Recommendation Summary (M5-015), and full
 * Dashboard Error Recovery (M5-021) remain later, separate,
 * dependency-gated tasks — not built here.
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
 * **`DashboardSummaryHeader` renders above the ok/error branch**, using
 * only `DashboardViewModel`'s base fields (identity + freshness), which
 * — unlike the metrics/warnings below — do not depend on
 * `calculatePortfolioSummary` succeeding (see
 * `features/dashboard/types/viewModel.ts`'s own `DashboardViewModelBase`
 * comment). This means a calculation failure still shows which portfolio
 * and price data are active, not just an error message.
 *
 * **`HealthFactorStatusSection`/`LiquidationRiskPanel` render only in the
 * `ok: true` branch** — both need a successfully-computed
 * `PortfolioSummary`, unlike the Summary Header above them.
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
      ) : (
        <div key={activePortfolioId} className="flex flex-col gap-6">
          <DashboardSummaryHeader viewModel={viewModel} />

          {viewModel.ok === false ? (
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
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Calculated {viewModel.formattedCalculationTimestamp}
              </p>

              <DashboardKpiGrid metrics={viewModel.metrics} />

              {record.summary.ok && (
                <HealthFactorStatusSection
                  status={buildHealthFactorStatus(record.portfolio, record.summary.data)}
                />
              )}

              {viewModel.warnings.length > 0 && (
                <div className="rounded-md border border-border bg-accent/20 p-3 text-sm">
                  {viewModel.warnings.map((warning) => (
                    <p key={warning.code} className="text-muted-foreground">
                      {warning.message}
                    </p>
                  ))}
                </div>
              )}

              <LiquidationRiskPanel
                panel={buildLiquidationRiskPanel(
                  record.portfolio,
                  viewModel.metrics,
                  viewModel.freshness.market,
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

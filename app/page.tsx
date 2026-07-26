'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import {
  buildDashboardViewModel,
  buildDataFreshnessIndicators,
  buildDebtAndInterestPanel,
  buildHealthFactorStatus,
  buildLeverageSummary,
  buildLiquidationRiskPanel,
  buildPortfolioComposition,
  buildRecommendationSummary,
  buildRiskWarnings,
  DashboardKpiGrid,
  DashboardSummaryHeader,
  DataFreshnessSection,
  DebtAndInterestPanel,
  HealthFactorStatusSection,
  LeverageSummarySection,
  LiquidationRiskPanel,
  PortfolioCompositionSection,
  RecommendationSummarySection,
  RiskWarningBanner,
} from '@/features/dashboard';
import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Dashboard Route — 06_TASKS.md M5-001 ("Create Dashboard Route").
 * Dependencies: M4-010. DoD: "The Dashboard route renders safely for
 * every portfolio state." Replaces the Milestone 1 `PlaceholderPage` at
 * `/` (03_UI.md: the Dashboard is the default landing page, answering
 * "Am I safe?" among its five objective questions).
 *
 * **Batch scope — Dashboard Foundation (Batch 1) + Summary Header
 * (Batch 2) + KPI Metrics (Batch 3) + Risk Sections part 1 (Batch 4:
 * M5-007, M5-009) + Risk Sections part 2 / Portfolio Composition
 * (Batch 5: M5-010, M5-011, M5-012) + Recommendations (Batch 6:
 * M5-013, M5-014; Batch 7: M5-015) + Data Freshness (Batch 8: M5-017,
 * resolving M5-018 with no new component), per 06_TASKS.md's own
 * "IMPLEMENTATION ORDER"**: "Dashboard Foundation → Summary Header →
 * KPI Metrics → Risk Sections → Portfolio Composition →
 * Recommendations → Responsive and Accessible States → Testing." M5-016
 * through M5-022 fall between "Recommendations" and "Responsive and
 * Accessible States" in `06_TASKS.md`'s own dependency graph (M5-023
 * depends on "M5-006 through M5-021") even though that coarse bucket
 * list does not name them individually.
 * `RecommendationSummarySection` (M5-015, Batch 7) completes
 * "Recommendations" — reuses Batch 4's `calculateTargetHealthFactorActions`
 * rather than `generateRecommendationSet` (M3-012), for the same
 * conflict #29 reason `HealthFactorStatusSection`/`LiquidationRiskPanel`
 * already do; see `features/dashboard/types/recommendationSummary.ts`.
 * `DataFreshnessSection` (M5-017, Batch 8) is a fuller, dedicated
 * freshness display (adds Protocol Parameters, "Manual-data status," and
 * "Refresh status" alongside the market-price line `DashboardSummaryHeader`
 * already renders) and also resolves M5-018 without new workflow code —
 * see `features/dashboard/types/dataFreshnessIndicators.ts` for the full
 * reasoning on both.
 * **M5-008 (Health Factor Range Visualization) remains wholly unbuilt** —
 * every one of its "Show" items is a Critical/Caution/Target zone
 * boundary, exactly Conflict #1's own blocked content, with no partial
 * subset the way M5-007/M5-010 had — re-confirmed in Batch 5, not just
 * carried over. Dashboard Quick Actions (M5-016), Loading/Empty States
 * (M5-019/M5-020), full Dashboard Error Recovery (M5-021), and Developer
 * Mode (M5-022) remain later, separate, dependency-gated tasks — not
 * built here.
 *
 * **`RiskWarningBanner` replaces the old raw `viewModel.warnings` list**
 * (previously rendered inline) — `buildRiskWarnings` already folds
 * `calculationWarnings` in as one of its three warning cases, so
 * rendering both would duplicate the same Service warnings twice.
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
 * **`DashboardSummaryHeader` and `DataFreshnessSection` both render
 * above the ok/error branch**, using only `DashboardViewModel`'s base
 * fields (identity + freshness), which — unlike the metrics/warnings
 * below — do not depend on `calculatePortfolioSummary` succeeding (see
 * `features/dashboard/types/viewModel.ts`'s own `DashboardViewModelBase`
 * comment). This means a calculation failure still shows which portfolio
 * and price data are active, not just an error message — arguably most
 * useful exactly when the calculation has failed.
 *
 * **Every other section renders only in the `ok: true` branch** — all
 * need a successfully-computed `PortfolioSummary`, unlike the Summary
 * Header above them.
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

  const summary = record !== undefined && record.summary.ok ? record.summary.data : null;
  const healthFactorStatus =
    record !== undefined && summary !== null
      ? buildHealthFactorStatus(record.portfolio, summary)
      : null;
  const riskWarnings =
    healthFactorStatus !== null && viewModel !== null && viewModel.ok
      ? buildRiskWarnings(healthFactorStatus, viewModel.freshness, viewModel.warnings)
      : [];
  const portfolioComposition =
    record !== undefined && summary !== null && viewModel !== null
      ? buildPortfolioComposition(record.portfolio, summary, viewModel.freshness.market)
      : null;
  const debtAndInterestPanel =
    record !== undefined && summary !== null && viewModel !== null
      ? buildDebtAndInterestPanel(record.portfolio, summary, viewModel.freshness.protocol)
      : null;
  const leverageSummary = summary !== null ? buildLeverageSummary(summary) : null;
  const dataFreshnessIndicators =
    viewModel !== null ? buildDataFreshnessIndicators(viewModel.freshness) : null;

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
          {dataFreshnessIndicators !== null && (
            <DataFreshnessSection indicators={dataFreshnessIndicators} />
          )}

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

              <RiskWarningBanner warnings={riskWarnings} />

              <DashboardKpiGrid metrics={viewModel.metrics} />

              {healthFactorStatus !== null && (
                <HealthFactorStatusSection status={healthFactorStatus} />
              )}

              <LiquidationRiskPanel
                panel={buildLiquidationRiskPanel(
                  record.portfolio,
                  viewModel.metrics,
                  viewModel.freshness.market,
                )}
              />

              {portfolioComposition !== null && (
                <PortfolioCompositionSection composition={portfolioComposition} />
              )}

              {debtAndInterestPanel !== null && (
                <DebtAndInterestPanel panel={debtAndInterestPanel} />
              )}

              {leverageSummary !== null && <LeverageSummarySection summary={leverageSummary} />}

              <RecommendationSummarySection
                summary={buildRecommendationSummary(record.portfolio)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

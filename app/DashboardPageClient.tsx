'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import { AaveV4LiveErrorNotice } from '@/components/aave/AaveV4LiveErrorNotice';
import { V4ProvenanceDetail } from '@/components/aave/V4ProvenanceDetail';
import {
  buildDashboardViewModel,
  buildDataFreshnessIndicators,
  buildDebtAndInterestPanel,
  buildHealthFactorStatus,
  buildLeverageSummary,
  buildLiquidationRiskPanel,
  buildPortfolioComposition,
  buildQuickActions,
  buildRecommendationSummary,
  buildRiskWarnings,
  DashboardErrorBanner,
  DashboardKpiGrid,
  DashboardSkeleton,
  DashboardSummaryHeader,
  DataFreshnessSection,
  DebtAndInterestPanel,
  DeveloperModeToggle,
  HealthFactorStatusSection,
  HealthFactorTrendSection,
  LeverageSummarySection,
  LiquidationBufferTrendSection,
  LiquidationRiskPanel,
  NoDebtNotice,
  PortfolioCompositionSection,
  QuickActionsSection,
  RecommendationSummarySection,
  RiskWarningBanner,
} from '@/features/dashboard';
import { useAaveLiveSync } from '@/hooks/useAaveLiveSync';
import { useAaveV4Sync } from '@/hooks/useAaveV4Sync';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { useDeveloperModeStore } from '@/stores/developerModeStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { deriveProtocolStatus, formatProtocolStatus } from '@/utils/protocolStatus';

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
 * `DashboardSkeleton` (M5-019, Batch 9) replaces the loading branch, and
 * `NoDebtNotice`/`RecommendationSummarySection`'s new empty-state
 * messaging (M5-020, Batch 9) close 4 of that task's 6 documented empty
 * states — see `features/dashboard/components/DashboardSkeleton.tsx` and
 * `features/dashboard/components/NoDebtNotice.tsx` for the full reasoning
 * on both, including why "Portfolio without collateral"/"Missing
 * prices"/"Missing protocol parameters" are not built.
 * `DashboardErrorBanner` (M5-021, Batch 10) replaces the old inline error
 * `<div>` — see `features/dashboard/components/DashboardErrorBanner.tsx`
 * for the full cross-document reasoning (Retry, Export recovery copy,
 * Error Identifier, and why "Use last valid data" is already structurally
 * satisfied, mirroring M4-017's own finding for the Portfolio page).
 * `QuickActionsSection` (M5-016, Batch 11) renders in the shared base
 * section, above the ok/error branch — "Edit portfolio"/"Update prices"
 * stay reachable during a calculation failure (arguably most useful
 * exactly then, the same reasoning already applied to the Summary Header
 * and Data Freshness section), while "Export portfolio" is gated on
 * `viewModel.ok` since it exports the *calculated* metrics — see
 * `features/dashboard/types/quickActions.ts` for the full reasoning,
 * including why "Run simulation"/"Build loop strategy"/"Create exit
 * plan" are marked unavailable rather than linked through as if
 * functional.
 * `DeveloperModeToggle` (M5-022, Batch 14) also renders in the shared
 * base section — a display preference, not tied to calculation success —
 * and `developerMode`/`engineVersion`/`formulaVersion` are threaded into
 * `DashboardKpiGrid`/`LiquidationRiskPanel` so each `KpiCard`'s own
 * `developerModeDetails` slot (unused since M5-005) finally has content.
 * See `features/dashboard/components/DeveloperModeToggle.tsx` for the
 * full reasoning on where the toggle's state lives (no Settings-page
 * task exists to route it through) and
 * `features/dashboard/utils/buildKpiDeveloperDetails.ts` for why only
 * "Raw values"/"Formula IDs"/"Engine version"/"Formula version" are
 * genuinely new, gated content — "Assumptions," "Warnings," and
 * "Calculation timestamp" are already visible to every user today, not
 * moved behind this toggle.
 * **M5-008 (Health Factor Range Visualization) remains wholly unbuilt** —
 * every one of its "Show" items is a Critical/Caution/Target zone
 * boundary, exactly Conflict #1's own blocked content, with no partial
 * subset the way M5-007/M5-010 had — re-confirmed in Batch 5, not just
 * carried over.
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
 * **Renders `DashboardSkeleton` exclusively** while `loadStatus ===
 * 'loading'` — previously a bare "Loading…" line rendered *alongside*
 * the no-portfolio/portfolio branch below it; restructured (Batch 9,
 * M5-019) into one mutually-exclusive three-way branch so only one state
 * is ever visible at a time.
 *
 * **No-portfolio state**: "Redirect or guide users when no portfolio
 * exists" — guides, matching `app/portfolio/page.tsx`'s own established
 * choice ("No portfolio is currently selected." + a link), not a hard
 * redirect. Consistency across both routes for the same underlying
 * condition, not a new decision.
 *
 * **`DashboardSummaryHeader`, `DataFreshnessSection`, and
 * `QuickActionsSection` all render above the ok/error branch**, using
 * only `DashboardViewModel`'s base fields (identity + freshness) plus
 * `viewModel.ok` itself for `QuickActionsSection`'s own export gating —
 * none of the three require a successfully-computed `PortfolioSummary`
 * to render *something* useful (see
 * `features/dashboard/types/viewModel.ts`'s own `DashboardViewModelBase`
 * comment). This means a calculation failure still shows which portfolio
 * and price data are active, and still lets the user navigate to fix the
 * problem — arguably most useful exactly when the calculation has
 * failed.
 *
 * **Every other section renders only in the `ok: true` branch** — all
 * need a successfully-computed `PortfolioSummary`, unlike the three
 * sections above them.
 *
 * **Error state**: `buildDashboardViewModel` can return `{ ok: false }`
 * (`calculatePortfolioSummary` genuinely fails for certain Zod-valid
 * inputs — confirmed via M4-017's own investigation, e.g. zero collateral
 * with nonzero debt). Rendered via `DashboardErrorBanner` (M5-021, Batch
 * 10): a clear message with each error's code, Retry, a link back to
 * `/portfolio`, and a recovery-copy download.
 *
 * **"Portfolio Status" / "Risk Category" (03_UI.md's Market Snapshot and
 * Health & Risk mockups) are not rendered** — blocked on Conflict #1
 * (Health Factor risk-band thresholds disagree across four documents);
 * see `features/dashboard/types/viewModel.ts` for the full reasoning.
 *
 * **`HealthFactorTrendSection` (v1.7.0 Batch 1, "Dashboard Health Factor
 * Trend Visibility")** renders directly after `HealthFactorStatusSection`
 * — a compact historical trend chart reading the same already-persisted
 * Portfolio History entries `PortfolioHistoryPanel.tsx`
 * (`app/portfolio/`) already charts, through the identical
 * `listPortfolioHistoryForPortfolio` service call. Presentation/read-layer
 * only: no new Engine formula, no new persisted field, no risk-band
 * classification (see that component's own header comment for the full
 * reasoning). Gated the same way `HealthFactorStatusSection` already is
 * (only in the `viewModel.ok === true` branch), not because it requires a
 * successfully-computed summary itself, but to keep this batch's scope
 * minimal and consistent with its neighboring section.
 *
 * **`LiquidationBufferTrendSection` (v1.8.0 Batch 1, "Dashboard
 * Liquidation Buffer Trend Visibility")** renders directly after
 * `LiquidationRiskPanel` — the same historical-trend pairing pattern
 * `HealthFactorTrendSection` established for `HealthFactorStatusSection`,
 * now completing the Dashboard's risk-trend story with the second metric.
 * Reads the same already-persisted Portfolio History entries through the
 * identical `listPortfolioHistoryForPortfolio` service call, deriving
 * each point via the v1.6.0 `calculateLiquidationBufferPercent` helper
 * (`services/portfolioHistory/`) applied to that entry's own
 * `marketPriceUsd`/`liquidationPriceUsd` — never the Engine's separate,
 * live-computed F-025 value `LiquidationRiskPanel` itself renders. No new
 * Engine formula, no new persisted field, no risk-band classification
 * (see that component's own header comment for the full reasoning).
 * Gated the same way its neighboring sections already are (only in the
 * `viewModel.ok === true` branch).
 */
export function DashboardPageClient() {
  const load = usePortfolioStore((state) => state.load);
  const loadStatus = usePortfolioStore((state) => state.loadStatus);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const record = usePortfolioStore((state) =>
    state.activePortfolioId !== null ? state.portfolios[state.activePortfolioId] : undefined,
  );
  const developerMode = useDeveloperModeStore((state) => state.enabled);
  const aaveMarketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const aaveProtocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const aaveV4Status = useAaveV4LiveDataStore((state) => state.status);
  const aaveV4LastFetchedAt = useAaveV4LiveDataStore((state) => state.lastFetchedAt);
  const aaveV4CollateralRiskStatus = useAaveV4CollateralRiskLiveDataStore((state) => state.status);
  const aaveV4CollateralRiskLastFetchedAt = useAaveV4CollateralRiskLiveDataStore(
    (state) => state.lastFetchedAt,
  );

  // Portfolio Live-State Cleanup batch — fetches and syncs live Aave V3
  // data independently of the Portfolio page, so a user landing directly
  // on the Dashboard (never having visited /portfolio this session) still
  // sees current on-chain values rather than a stale/never-synced record.
  useAaveLiveSync(activePortfolioId);
  // V4 Readiness Audit §12 Stage 7, wired to a real UI at Stage 13, joined
  // by V4 collateral-risk sync at Stage 23F via `useAaveV4Sync` — same
  // independence as above, for both V4 debt-state and collateral-risk
  // sync. Still a strict no-op for any portfolio that hasn't opted into
  // V4 via `AaveProtocolVersionForm` (`app/portfolio/PortfolioPageClient.tsx`)
  // — see `useAaveV4Sync`'s own header comment for the exact gating condition.
  useAaveV4Sync(activePortfolioId);

  useEffect(() => {
    load();
  }, [load]);

  // Dashboard Live-State Cleanup batch — the same live snapshot
  // `aaveMarketQuote`/the Portfolio page's own read-only fields read,
  // passed through so `buildDashboardViewModel`'s freshness/origin
  // reporting stops hardcoding "manual" on values that are actually
  // live-synced (see that module's own header comment).
  const viewModel =
    record !== undefined
      ? buildDashboardViewModel(record.portfolio, record.summary, {
          marketQuote: aaveMarketQuote,
          protocolQuote: aaveProtocolQuote,
        })
      : null;

  const summary = record !== undefined && record.summary.ok ? record.summary.data : null;
  // V4 Readiness Audit §12 Stage 15 — real Engine metadata for
  // `deriveAaveV4EffectiveBorrowRate` to thread through `formulaStep`,
  // sourced from this same already-computed, already-real summary
  // (never fabricated) exactly like `PortfolioPageClient.tsx`'s own
  // `beforeSummary.metadata` reuse for the identical purpose.
  const summaryTracked =
    record !== undefined && record.summary.ok
      ? {
          engineVersion: record.summary.metadata.engineVersion,
          formulaVersion: record.summary.metadata.formulaVersion,
        }
      : null;
  const healthFactorStatus =
    record !== undefined && summary !== null
      ? buildHealthFactorStatus(record.portfolio, summary)
      : null;
  const riskWarnings =
    healthFactorStatus !== null && viewModel !== null && viewModel.ok
      ? buildRiskWarnings(healthFactorStatus, viewModel.freshness, viewModel.warnings)
      : [];
  const portfolioComposition =
    record !== undefined && summary !== null && summaryTracked !== null && viewModel !== null
      ? buildPortfolioComposition(
          record.portfolio,
          summary,
          viewModel.freshness.market,
          summaryTracked,
        )
      : null;
  const debtAndInterestPanel =
    record !== undefined && summary !== null && summaryTracked !== null && viewModel !== null
      ? buildDebtAndInterestPanel(
          record.portfolio,
          summary,
          viewModel.freshness.protocol,
          summaryTracked,
        )
      : null;
  const leverageSummary = summary !== null ? buildLeverageSummary(summary) : null;
  const dataFreshnessIndicators =
    viewModel !== null && record !== undefined
      ? buildDataFreshnessIndicators(viewModel.freshness, record.portfolio.protocolVersion)
      : null;
  const quickActions = viewModel !== null ? buildQuickActions(viewModel.ok) : null;
  const protocolStatus =
    record !== undefined
      ? deriveProtocolStatus({
          protocolVersion: record.portfolio.protocolVersion,
          v4PositionSet: record.portfolio.v4Position !== undefined,
          v4DebtStateSet: record.portfolio.v4DebtState !== undefined,
          aaveMarketQuote,
          aaveV4Status,
          aaveV4LastFetchedAt,
          v4CollateralRiskSet: record.portfolio.v4CollateralRisk !== undefined,
          aaveV4CollateralRiskStatus,
          aaveV4CollateralRiskLastFetchedAt,
          v4DebtStateSource: record.portfolio.v4DebtStateSource,
          v4CollateralRiskSource: record.portfolio.v4CollateralRiskSource,
          v4BaseDrawnAprSource: record.portfolio.v4BaseDrawnAprSource,
          marketSource: record.portfolio.marketSource,
          now: new Date().toISOString(),
        })
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">&ldquo;Am I safe?&rdquo;</p>
      </div>

      {loadStatus === 'loading' ? (
        <DashboardSkeleton />
      ) : activePortfolioId === null || record === undefined || viewModel === null ? (
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
          <p className="text-xs text-muted-foreground">
            {/* V4 Mixed-Provenance UX batch — see `PortfolioPageClient.tsx`'s
                own identical comment for why only `'live'`/`'manual'` are
                replaced with the breakdown. */}
            {protocolStatus !== null &&
            protocolStatus.version === 'v4' &&
            (protocolStatus.status === 'live' || protocolStatus.status === 'manual') ? (
              <V4ProvenanceDetail breakdown={protocolStatus.breakdown} />
            ) : (
              <span className="rounded-full bg-muted px-2 py-0.5">
                {protocolStatus !== null ? formatProtocolStatus(protocolStatus) : null}
              </span>
            )}
          </p>
          <AaveV4LiveErrorNotice portfolioId={activePortfolioId} />
          {dataFreshnessIndicators !== null && (
            <DataFreshnessSection indicators={dataFreshnessIndicators} />
          )}
          <DeveloperModeToggle />
          {quickActions !== null && (
            <QuickActionsSection
              actions={quickActions}
              portfolioId={activePortfolioId}
              portfolioName={viewModel.portfolioName}
              calculationTimestamp={viewModel.ok ? viewModel.calculationTimestamp : ''}
              metrics={viewModel.ok ? viewModel.metrics : null}
            />
          )}

          {viewModel.ok === false ? (
            <DashboardErrorBanner
              portfolioId={activePortfolioId}
              portfolio={record.portfolio}
              viewModel={viewModel}
            />
          ) : (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Calculated {viewModel.formattedCalculationTimestamp}
              </p>

              <RiskWarningBanner warnings={riskWarnings} />

              <NoDebtNotice hasDebt={summary !== null && summary.liquidation !== null} />

              <DashboardKpiGrid
                metrics={viewModel.metrics}
                developerMode={developerMode}
                engineVersion={viewModel.engineVersion}
                formulaVersion={viewModel.formulaVersion}
              />

              {healthFactorStatus !== null && (
                <HealthFactorStatusSection status={healthFactorStatus} />
              )}

              <HealthFactorTrendSection
                portfolioId={activePortfolioId}
                portfolioUpdatedAt={record.portfolio.updatedAt}
              />

              <LiquidationRiskPanel
                panel={buildLiquidationRiskPanel(
                  record.portfolio,
                  viewModel.metrics,
                  viewModel.freshness.market,
                )}
                developerMode={developerMode}
                engineVersion={viewModel.engineVersion}
                formulaVersion={viewModel.formulaVersion}
              />

              <LiquidationBufferTrendSection
                portfolioId={activePortfolioId}
                portfolioUpdatedAt={record.portfolio.updatedAt}
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

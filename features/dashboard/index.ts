/**
 * Dashboard feature module — public entry point. 06_TASKS.md M5-002
 * ("Create Dashboard Feature Structure") DoD: "Dashboard-specific
 * implementation remains isolated from generic shared components."
 * `app/page.tsx` (M5-001) and any later Dashboard component/hook should
 * import from here, not reach into `features/dashboard/*` subpaths
 * directly.
 *
 * `hooks/` and `services/` remain empty (each holding only a
 * `.gitkeep`) — **Batch 8 (M5-017) found no Dashboard task actually needs
 * them**: M5-018 (Refresh Workflow), the task this comment previously
 * expected to fill them, resolved to reusing the existing synchronous
 * `recomputeSummary` Store action with no new hook or Service (see
 * `types/dataFreshnessIndicators.ts`'s own header comment for why). The
 * directories are kept for whichever later milestone task first needs
 * them, per M1-003's own directory-skeleton precedent.
 * `components/` gained its first real file in Batch 2 (M5-004); Batch 3
 * (M5-005, M5-006) added the Shared KPI Card and Core KPI Grid; Batch 4
 * (M5-007, M5-009) added the Health Factor Status Component and
 * Liquidation Risk Panel; Batch 5 (M5-010, M5-011, M5-012) added the
 * Risk Warning Banner and Portfolio Composition Section (M5-012 has no
 * component — see `types/portfolioComposition.ts`'s own header comment);
 * Batch 6 (M5-013, M5-014) added the Debt and Interest Panel and
 * Leverage Summary Section; Batch 7 (M5-015) added the Recommendation
 * Summary Section, completing the "Recommendations" Implementation
 * Order step; Batch 8 (M5-017) added the Data Freshness Indicators
 * section, and resolved M5-018 with no new component; Batch 9 (M5-019,
 * M5-020) added the Dashboard Skeleton and the No-Debt Notice, and
 * extended the Recommendation Summary Section with empty-state messaging;
 * Batch 10 (M5-021) added the Dashboard Error Banner, replacing the
 * previous inline error `<div>`; Batch 11 (M5-016) added the Quick
 * Actions Section and the Portfolio Summary export (JSON/CSV).
 */
export * from './components/DashboardErrorBanner';
export * from './components/DashboardKpiGrid';
export * from './components/DashboardSkeleton';
export * from './components/DashboardSummaryHeader';
export * from './components/DataFreshnessSection';
export * from './components/DebtAndInterestPanel';
export * from './components/HealthFactorStatusSection';
export * from './components/KpiCard';
export * from './components/LeverageSummarySection';
export * from './components/LiquidationRiskPanel';
export * from './components/NoDebtNotice';
export * from './components/PortfolioCompositionSection';
export * from './components/QuickActionsSection';
export * from './components/RecommendationSummarySection';
export * from './components/RiskWarningBanner';
export * from './types/dataFreshnessIndicators';
export * from './types/debtAndInterestPanel';
export * from './types/healthFactorStatus';
export * from './types/leverageSummary';
export * from './types/liquidationRiskPanel';
export * from './types/portfolioComposition';
export * from './types/quickActions';
export * from './types/recommendationSummary';
export * from './types/riskWarnings';
export * from './types/viewModel';
export * from './utils/buildDashboardViewModel';
export * from './utils/buildDataFreshnessIndicators';
export * from './utils/buildDebtAndInterestPanel';
export * from './utils/buildHealthFactorStatus';
export * from './utils/buildLeverageSummary';
export * from './utils/buildLiquidationRiskPanel';
export * from './utils/buildPortfolioComposition';
export * from './utils/buildQuickActions';
export * from './utils/buildRecommendationSummary';
export * from './utils/buildRiskWarnings';
export * from './utils/exportPortfolioSummary';
export * from './utils/format';

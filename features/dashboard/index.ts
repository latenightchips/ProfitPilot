/**
 * Dashboard feature module — public entry point. 06_TASKS.md M5-002
 * ("Create Dashboard Feature Structure") DoD: "Dashboard-specific
 * implementation remains isolated from generic shared components."
 * `app/page.tsx` (M5-001) and any later Dashboard component/hook should
 * import from here, not reach into `features/dashboard/*` subpaths
 * directly.
 *
 * `hooks/` and `services/` remain empty (each holding only a
 * `.gitkeep`) until the Dashboard tasks that need them — M5-018 (Refresh
 * Workflow) — are actually implemented; the directory skeleton exists
 * now so that later batch only adds files, not restructures, mirroring
 * M1-003's own precedent for the top-level directory layout.
 * `components/` gained its first real file in Batch 2 (M5-004); Batch 3
 * (M5-005, M5-006) added the Shared KPI Card and Core KPI Grid; Batch 4
 * (M5-007, M5-009) added the Health Factor Status Component and
 * Liquidation Risk Panel; Batch 5 (M5-010, M5-011, M5-012) added the
 * Risk Warning Banner and Portfolio Composition Section (M5-012 has no
 * component — see `types/portfolioComposition.ts`'s own header comment);
 * Batch 6 (M5-013, M5-014) added the Debt and Interest Panel and
 * Leverage Summary Section; Batch 7 (M5-015) added the Recommendation
 * Summary Section, completing the "Recommendations" Implementation
 * Order step.
 */
export * from './components/DashboardKpiGrid';
export * from './components/DashboardSummaryHeader';
export * from './components/DebtAndInterestPanel';
export * from './components/HealthFactorStatusSection';
export * from './components/KpiCard';
export * from './components/LeverageSummarySection';
export * from './components/LiquidationRiskPanel';
export * from './components/PortfolioCompositionSection';
export * from './components/RecommendationSummarySection';
export * from './components/RiskWarningBanner';
export * from './types/debtAndInterestPanel';
export * from './types/healthFactorStatus';
export * from './types/leverageSummary';
export * from './types/liquidationRiskPanel';
export * from './types/portfolioComposition';
export * from './types/recommendationSummary';
export * from './types/riskWarnings';
export * from './types/viewModel';
export * from './utils/buildDashboardViewModel';
export * from './utils/buildDebtAndInterestPanel';
export * from './utils/buildHealthFactorStatus';
export * from './utils/buildLeverageSummary';
export * from './utils/buildLiquidationRiskPanel';
export * from './utils/buildPortfolioComposition';
export * from './utils/buildRecommendationSummary';
export * from './utils/buildRiskWarnings';
export * from './utils/format';

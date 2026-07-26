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
 * Liquidation Risk Panel.
 */
export * from './components/DashboardKpiGrid';
export * from './components/DashboardSummaryHeader';
export * from './components/HealthFactorStatusSection';
export * from './components/KpiCard';
export * from './components/LiquidationRiskPanel';
export * from './types/healthFactorStatus';
export * from './types/liquidationRiskPanel';
export * from './types/viewModel';
export * from './utils/buildDashboardViewModel';
export * from './utils/buildHealthFactorStatus';
export * from './utils/buildLiquidationRiskPanel';
export * from './utils/format';

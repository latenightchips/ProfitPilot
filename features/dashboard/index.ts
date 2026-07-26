/**
 * Dashboard feature module — public entry point. 06_TASKS.md M5-002
 * ("Create Dashboard Feature Structure") DoD: "Dashboard-specific
 * implementation remains isolated from generic shared components."
 * `app/page.tsx` (M5-001) and any later Dashboard component/hook should
 * import from here, not reach into `features/dashboard/*` subpaths
 * directly.
 *
 * `components/`, `hooks/`, and `services/` remain empty (each holding
 * only a `.gitkeep`) until the Dashboard tasks that need them — M5-004
 * onward for components, M5-018 (Refresh Workflow) for a hook/service —
 * are actually implemented; the directory skeleton exists now so those
 * later batches only add files, not restructure, mirroring M1-003's own
 * precedent for the top-level directory layout.
 */
export * from './types/viewModel';
export * from './utils/buildDashboardViewModel';
export * from './utils/format';

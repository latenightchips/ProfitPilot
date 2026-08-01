/**
 * Exit Planner Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-011 ("Implement Exit Planning Service") is its first
 * occupant. Milestone 7 Batch 4 re-exports the Engine's own
 * `ExitTarget`/`UnavailableExitCost` types here too, so
 * `stores/exitPlannerStore.ts` and `features/exit-planner/**` never
 * need to import `@/engine` directly — the same "Services own the
 * boundary" precedent `services/loop/index.ts` already established for
 * Loop Builder.
 */
export { type ExitPlanResult, type ExitTransactionSummary, planExit } from './plan';
export { type ExitTarget, type UnavailableExitCost } from '@/engine';

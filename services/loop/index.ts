/**
 * Loop Service — public entry point.
 *
 * 06_TASKS.md M3-001 ("Create Service Foundation") established this
 * directory; M3-010 ("Implement Loop Strategy Service") is its first
 * occupant. Milestone 7 Batch 2 re-exports the Engine's own
 * `LoopSafetyCheck`/`LoopSafetyFinding`/`LoopStopReason`/
 * `LoopStrategyResult` types here too, so `stores/loopBuilderStore.ts`
 * and `features/loop-builder/**` never need to import `@/engine`
 * directly — the same "Services own the boundary" precedent this
 * barrel already established for its own Service-level exports.
 */
export { type LoopStrategyPreview, type LoopStrategySettings, planLoopStrategy } from './strategy';
export {
  type LoopSafetyCheck,
  type LoopSafetyFinding,
  type LoopStopReason,
  type LoopStrategyResult,
} from '@/engine';

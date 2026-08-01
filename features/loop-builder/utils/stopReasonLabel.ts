import type { LoopStopReason } from '@/services';

/**
 * Human-readable labels for the Engine's own exhaustive 3-value
 * `LoopStopReason` union (`engine/loop/calculateLoopStrategy.ts`) — no
 * new classification invented, just labeled for display. Extracted at
 * Milestone 7 Batch 3 from `LoopStrategySummary.tsx` (Batch 2), which
 * was the first of now two consumers (`LoopStrategySummary.tsx`,
 * `LoopSafetyAnalysis.tsx`, M7-013's own "Stop condition" Display item).
 */
const STOP_REASON_LABELS: Record<LoopStopReason, string> = {
  MAX_LOOPS_REACHED: 'Maximum number of loops reached',
  MIN_HEALTH_FACTOR_REACHED: 'Minimum Health Factor reached',
  NO_AVAILABLE_BORROW: 'No further borrowing capacity available',
};

/**
 * `stopReason` is typed as the exhaustive `LoopStopReason` union, so the
 * lookup can never miss — this signature has no fallback path to keep,
 * unlike the pre-extraction `Record<string, string>` version, which
 * carried a `??` fallback that was already type-system-provably
 * unreachable (see `LoopStrategySummary.tsx`'s own prior header comment
 * note, Batch 2).
 */
export function stopReasonLabel(stopReason: LoopStopReason): string {
  return STOP_REASON_LABELS[stopReason];
}

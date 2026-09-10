import type { LoopStopReason } from '@/services';

/**
 * Human-readable labels for the Engine's own exhaustive 3-value
 * `LoopStopReason` union (`engine/loop/calculateLoopStrategy.ts`) — no
 * new classification invented, just labeled for display. Extracted at
 * Milestone 7 Batch 3 from `LoopStrategySummary.tsx` (Batch 2), which
 * was the first of now two consumers (`LoopStrategySummary.tsx`,
 * `LoopSafetyAnalysis.tsx`, M7-013's own "Stop condition" Display item;
 * `ApplyLoopAsSimulation.tsx` is a third).
 *
 * **`MIN_HEALTH_FACTOR_REACHED` wording (v1.23.0 validation pass).**
 * `calculateLoopStrategy.ts`'s own header comment and step loop are
 * explicit: this stop reason fires when a *prospective* step's
 * `newHealthFactor <= minHealthFactor` — the breaching step is never
 * committed, and every already-committed step's own resulting Health
 * Factor necessarily stays above the configured minimum. "Minimum
 * Health Factor reached" previously described this ambiguously — a
 * reader could take "reached" to mean the *resulting* Health Factor
 * touched the floor, which is exactly backwards (it did not; that step
 * was rejected specifically because it would have). Reworded to name
 * the NEXT loop, not the current result — matching
 * `LoopSafetyAnalysis.tsx`'s own "Minimum Health Factor Too Low" row
 * (a completely different check: whether the *configured* floor itself
 * is invalid), so the two no longer share overlapping "reached"
 * language for unrelated concepts.
 */
const STOP_REASON_LABELS: Record<LoopStopReason, string> = {
  MAX_LOOPS_REACHED: 'Maximum number of loops reached',
  MIN_HEALTH_FACTOR_REACHED: 'Next loop would breach Minimum Health Factor',
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

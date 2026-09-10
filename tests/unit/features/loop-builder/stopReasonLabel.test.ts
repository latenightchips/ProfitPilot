import { describe, expect, it } from 'vitest';

import { stopReasonLabel } from '@/features/loop-builder/utils/stopReasonLabel';
import type { LoopStopReason } from '@/services';

/**
 * v1.23.0 validation pass — no dedicated test file existed for this
 * shared label util before this batch (it was only exercised indirectly
 * through `LoopStrategySummary.test.tsx`/`ApplyLoopAsSimulation.test.tsx`,
 * both of which call the real function rather than hardcoding its
 * output). Added directly alongside the `MIN_HEALTH_FACTOR_REACHED`
 * wording fix — see `stopReasonLabel.ts`'s own header comment for why
 * "Minimum Health Factor reached" was ambiguous with
 * `LoopSafetyAnalysis.tsx`'s unrelated "Minimum Health Factor Too Low"
 * check, and `LoopSafetyAnalysis.test.tsx`'s own new boundary-case test
 * for the full reported scenario this fix addresses.
 */
describe('stopReasonLabel', () => {
  it('never labels MIN_HEALTH_FACTOR_REACHED as the current/resulting Health Factor having "reached" anything — it names the NEXT loop', () => {
    const label = stopReasonLabel('MIN_HEALTH_FACTOR_REACHED');
    expect(label).toBe('Next loop would breach Minimum Health Factor');
    expect(label).not.toMatch(/reached/i);
  });

  it('labels MAX_LOOPS_REACHED as an unambiguous, already-true fact about the executed strategy', () => {
    expect(stopReasonLabel('MAX_LOOPS_REACHED')).toBe('Maximum number of loops reached');
  });

  it('labels NO_AVAILABLE_BORROW as an unambiguous, already-true fact about the executed strategy', () => {
    expect(stopReasonLabel('NO_AVAILABLE_BORROW')).toBe('No further borrowing capacity available');
  });

  it('covers every value of the exhaustive LoopStopReason union with a non-empty, human-readable label', () => {
    const allReasons: LoopStopReason[] = [
      'MAX_LOOPS_REACHED',
      'MIN_HEALTH_FACTOR_REACHED',
      'NO_AVAILABLE_BORROW',
    ];
    for (const reason of allReasons) {
      const label = stopReasonLabel(reason);
      expect(label.length).toBeGreaterThan(0);
      expect(label).not.toMatch(/^[A-Z_]+$/);
    }
  });
});

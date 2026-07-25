import { describe, expect, it } from 'vitest';

import { calculateLoopCosts } from '@/engine/loop/calculateLoopCosts';

describe('calculateLoopCosts (M2-017, partial, F-037)', () => {
  it('computes borrowing interest (F-032) and break-even appreciation (F-037)', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-037');
    expect(result.value.borrowingInterest).toBe(2500);
    expect(result.value.breakEvenAppreciation).toBeCloseTo(0.016667, 6);
  });

  it('itemizes the cost items that are not computed, with a reason for each', () => {
    const result = calculateLoopCosts(50000, 0.05, 150000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const items = result.value.unavailable.map((u) => u.item);
    expect(items).toEqual(['swapFees', 'slippage', 'gasEstimate', 'totalImplementationCost']);
    for (const entry of result.value.unavailable) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('propagates a failure from an invalid borrow APR', () => {
    expect(calculateLoopCosts(50000, -0.01, 150000).ok).toBe(false);
  });

  it('propagates a failure from zero exposure', () => {
    expect(calculateLoopCosts(50000, 0.05, 0).ok).toBe(false);
  });
});

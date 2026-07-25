import { describe, expect, it } from 'vitest';

import { calculateTargetDebt } from '@/engine/exit/calculateTargetDebt';

describe('calculateTargetDebt (F-040)', () => {
  it('matches the documented example: collateral $120,000, LT 80%, target HF 2.00 -> $48,000', () => {
    const result = calculateTargetDebt(120000, 0.8, 2.0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(48000);
      expect(result.metadata.formulaId).toBe('F-040');
    }
  });

  it('rejects a non-positive target Health Factor', () => {
    expect(calculateTargetDebt(120000, 0.8, 0).ok).toBe(false);
    expect(calculateTargetDebt(120000, 0.8, -1).ok).toBe(false);
  });

  it('rejects an invalid liquidation threshold', () => {
    expect(calculateTargetDebt(120000, 1.5, 2.0).ok).toBe(false);
  });

  it('rejects negative collateral', () => {
    expect(calculateTargetDebt(-1, 0.8, 2.0).ok).toBe(false);
  });
});

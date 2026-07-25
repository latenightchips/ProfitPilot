import { describe, expect, it } from 'vitest';

import { calculateRequiredDebtRepayment } from '@/engine/exit/calculateRequiredDebtRepayment';

describe('calculateRequiredDebtRepayment (F-041)', () => {
  it('matches the documented example: current debt $60,000, target debt $48,000 -> $12,000', () => {
    const result = calculateRequiredDebtRepayment(60000, 48000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(12000);
      expect(result.metadata.formulaId).toBe('F-041');
    }
  });

  it('clamps to 0 when target debt exceeds current debt, per the documented Math.max(0, ...)', () => {
    const result = calculateRequiredDebtRepayment(40000, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('returns 0 for a full exit where current debt already matches target debt', () => {
    const result = calculateRequiredDebtRepayment(0, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects negative current debt', () => {
    expect(calculateRequiredDebtRepayment(-1, 0).ok).toBe(false);
  });

  it('rejects negative target debt', () => {
    expect(calculateRequiredDebtRepayment(60000, -1).ok).toBe(false);
  });
});

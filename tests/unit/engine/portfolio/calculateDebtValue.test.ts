import { describe, expect, it } from 'vitest';

import { calculateDebtValue } from '@/engine/portfolio/calculateDebtValue';

describe('calculateDebtValue (F-003)', () => {
  it('matches the documented example: $22,500 borrowed USDC = $22,500', () => {
    const result = calculateDebtValue({ asset: 'USDC', balance: 22500 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(22500);
      expect(result.metadata.formulaId).toBe('F-003');
    }
  });

  it('returns 0 for no debt', () => {
    const result = calculateDebtValue({ asset: 'USDC', balance: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects a negative balance', () => {
    const result = calculateDebtValue({ asset: 'USDC', balance: -1 });
    expect(result.ok).toBe(false);
  });
});

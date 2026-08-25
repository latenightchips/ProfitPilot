import { describe, expect, it } from 'vitest';

import { calculateTransactionGasCost } from '@/engine/execution/calculateTransactionGasCost';

describe('calculateTransactionGasCost (F-072)', () => {
  it('matches the documented example: 4 transactions x $15.00 -> $60.00', () => {
    const result = calculateTransactionGasCost(4, 15);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(60);
      expect(result.metadata.formulaId).toBe('F-072');
    }
  });

  it('returns 0 when transactionCount is 0', () => {
    const result = calculateTransactionGasCost(0, 15);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('returns 0 when gasCostPerTransactionUsd is 0', () => {
    const result = calculateTransactionGasCost(4, 0);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });
});

/**
 * Invalid domains — 02_Formulas.md F-072's own "Invalid-Input Behavior".
 */
describe('calculateTransactionGasCost — invalid domains (P1-5)', () => {
  it('rejects a negative transactionCount', () => {
    expect(calculateTransactionGasCost(-1, 15).ok).toBe(false);
  });

  it('rejects a non-integer transactionCount', () => {
    expect(calculateTransactionGasCost(2.5, 15).ok).toBe(false);
  });

  it('rejects a negative gasCostPerTransactionUsd', () => {
    expect(calculateTransactionGasCost(4, -1).ok).toBe(false);
  });

  it('never leaks NaN or Infinity', () => {
    const result = calculateTransactionGasCost(1000, 1000);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.value)).toBe(true);
    expect(Number.isNaN(result.value)).toBe(false);
  });
});

/**
 * Gas isolation — 02_Formulas.md F-072's own explicit "must not" list.
 * This primitive returns a bare number; there is nothing for it to leak
 * into (no debt/collateral/HF/interest parameter exists on its
 * signature at all) — this test documents that structural guarantee
 * rather than merely asserting the arithmetic.
 */
describe('calculateTransactionGasCost — gas isolation (P1-5)', () => {
  it('the function signature has no debt, collateral, BTC price, or interest-rate parameter to accidentally couple to', () => {
    expect(calculateTransactionGasCost.length).toBe(2);
  });

  it('does not derive transactionCount from any implicit step count — it is a bare, caller-supplied number', () => {
    const fourSteps = calculateTransactionGasCost(4, 15);
    const oneTransactionForFourSteps = calculateTransactionGasCost(1, 15);
    expect(fourSteps.ok && oneTransactionForFourSteps.ok).toBe(true);
    if (fourSteps.ok && oneTransactionForFourSteps.ok) {
      // Both are equally valid results for a 4-step strategy — the
      // caller decides the mapping, not this formula.
      expect(fourSteps.value).toBe(60);
      expect(oneTransactionForFourSteps.value).toBe(15);
    }
  });
});

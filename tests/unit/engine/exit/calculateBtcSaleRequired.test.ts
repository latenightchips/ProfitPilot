import { describe, expect, it } from 'vitest';

import { calculateBtcSaleRequired } from '@/engine/exit/calculateBtcSaleRequired';

describe('calculateBtcSaleRequired (F-071, generalizes F-042)', () => {
  it('matches the documented example: repayment $12,000, BTC price $60,000 -> 0.20 BTC', () => {
    const result = calculateBtcSaleRequired(12000, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0.2);
      expect(result.metadata.formulaId).toBe('F-071');
    }
  });

  it('returns 0 for zero repayment', () => {
    const result = calculateBtcSaleRequired(0, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects negative repayment', () => {
    expect(calculateBtcSaleRequired(-1, 60000).ok).toBe(false);
  });

  it('rejects a non-positive BTC price', () => {
    expect(calculateBtcSaleRequired(12000, 0).ok).toBe(false);
  });
});

/**
 * Backward compatibility — V4 Readiness Audit §12 P1-5. Absent
 * assumptions, and explicit zero assumptions, must both reproduce the
 * pre-P1-5 frictionless F-042 output exactly.
 */
describe('calculateBtcSaleRequired — backward compatibility (P1-5)', () => {
  it('omitted assumptions produce the identical result to before P1-5', () => {
    const withoutAssumptions = calculateBtcSaleRequired(12000, 60000);
    expect(withoutAssumptions.ok).toBe(true);
    if (withoutAssumptions.ok) expect(withoutAssumptions.value).toBe(0.2);
  });

  it('explicit zero rates reproduce the identical frictionless result', () => {
    const result = calculateBtcSaleRequired(12000, 60000, { swapFeeRate: 0, slippageRate: 0 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0.2);
  });
});

/**
 * F-071 execution friction — non-zero rates must increase BTC sold by
 * exactly the documented relationship, verified against 02_Formulas.md's
 * own worked example (Repayment $25,000, 0.3%/0.5%, BTC $50,000 ->
 * 0.50402464 BTC).
 */
describe('calculateBtcSaleRequired — F-071 execution friction (P1-5)', () => {
  it('non-zero swap fee and slippage increase BTC sold by exactly repayment / (btcPrice * effectiveRate)', () => {
    const result = calculateBtcSaleRequired(25000, 50000, {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeCloseTo(0.50402464, 8);
    expect(result.value).toBeGreaterThan(0.5);
  });
});

/**
 * Composition — same multiplicative-not-additive requirement as F-070,
 * verified independently here since F-071 has its own separate
 * `resolveEffectiveExecutionRate` call site.
 */
describe('calculateBtcSaleRequired — multiplicative, not additive, composition (P1-5)', () => {
  it('at 1% swap fee / 2% slippage, uses the multiplicative Effective Rate (0.9702), not the additive one (0.97)', () => {
    const result = calculateBtcSaleRequired(100000, 50000, {
      swapFeeRate: 0.01,
      slippageRate: 0.02,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const multiplicativeExpected = 100000 / (50000 * 0.9702);
    const additiveExpected = 100000 / (50000 * 0.97);
    expect(result.value).toBeCloseTo(multiplicativeExpected, 10);
    expect(result.value).not.toBeCloseTo(additiveExpected, 4);
  });
});

/**
 * Invalid domains — 02_Formulas.md F-071's own "Invalid-Input Behavior":
 * Effective Rate must be strictly greater than zero; never a silent
 * division by zero, Infinity, NaN, or negative BTC Sold.
 */
describe('calculateBtcSaleRequired — invalid execution-cost domains (P1-5)', () => {
  it('rejects a negative swapFeeRate', () => {
    expect(calculateBtcSaleRequired(12000, 60000, { swapFeeRate: -0.01, slippageRate: 0 }).ok).toBe(
      false,
    );
  });

  it('rejects a negative slippageRate', () => {
    expect(calculateBtcSaleRequired(12000, 60000, { swapFeeRate: 0, slippageRate: -0.01 }).ok).toBe(
      false,
    );
  });

  it('rejects swapFeeRate >= 1 — never a silent division by zero or negative BTC Sold', () => {
    const result = calculateBtcSaleRequired(12000, 60000, { swapFeeRate: 1, slippageRate: 0 });
    expect(result.ok).toBe(false);
  });

  it('rejects slippageRate >= 1', () => {
    const result = calculateBtcSaleRequired(12000, 60000, { swapFeeRate: 0, slippageRate: 1 });
    expect(result.ok).toBe(false);
  });

  it('never leaks NaN or Infinity even at rates approaching the domain boundary', () => {
    const result = calculateBtcSaleRequired(12000, 60000, {
      swapFeeRate: 0.999999,
      slippageRate: 0.999999,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.value)).toBe(true);
    expect(Number.isNaN(result.value)).toBe(false);
    expect(result.value).toBeGreaterThan(0);
  });
});

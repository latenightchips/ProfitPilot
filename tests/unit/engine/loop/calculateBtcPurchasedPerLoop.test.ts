import { describe, expect, it } from 'vitest';

import { calculateBtcPurchasedPerLoop } from '@/engine/loop/calculateBtcPurchasedPerLoop';

describe('calculateBtcPurchasedPerLoop (F-070, generalizes F-015)', () => {
  it('matches the documented example: borrow $30,000, BTC price $60,000 -> 0.50 BTC', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(0.5);
      expect(result.metadata.formulaId).toBe('F-070');
    }
  });

  it('matches Scenario A from the Leverage & Loop unit test examples: borrow $25,000, BTC price $50,000 -> 0.50 BTC', () => {
    const result = calculateBtcPurchasedPerLoop(25000, 50000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0.5);
  });

  it('returns 0 for a zero borrow amount', () => {
    const result = calculateBtcPurchasedPerLoop(0, 60000);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('rejects a negative borrow amount', () => {
    expect(calculateBtcPurchasedPerLoop(-1, 60000).ok).toBe(false);
  });

  it('rejects a non-positive BTC price', () => {
    expect(calculateBtcPurchasedPerLoop(30000, 0).ok).toBe(false);
  });
});

/**
 * Backward compatibility — V4 Readiness Audit §12 P1-5. Absent
 * assumptions, and explicit zero assumptions, must both reproduce the
 * pre-P1-5 frictionless F-015 output exactly, not merely approximately.
 */
describe('calculateBtcPurchasedPerLoop — backward compatibility (P1-5)', () => {
  it('omitted assumptions produce the identical result to before P1-5', () => {
    const withoutAssumptions = calculateBtcPurchasedPerLoop(30000, 60000);
    expect(withoutAssumptions.ok).toBe(true);
    if (withoutAssumptions.ok) expect(withoutAssumptions.value).toBe(0.5);
  });

  it('explicit zero rates reproduce the identical frictionless result', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 0,
      slippageRate: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0.5);
  });
});

/**
 * F-070 execution friction — non-zero rates must reduce BTC purchased by
 * exactly the documented multiplicative relationship, verified against
 * 02_Formulas.md's own worked example (Borrow $30,000, 0.3%/0.5%, BTC
 * $60,000 -> 0.49600750 BTC).
 */
describe('calculateBtcPurchasedPerLoop — F-070 execution friction (P1-5)', () => {
  it('non-zero swap fee and slippage reduce BTC purchased by exactly (1 - swapFeeRate) * (1 - slippageRate)', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 0.003,
      slippageRate: 0.005,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // effectiveRate = 0.997 * 0.995 = 0.992015; effectiveNotional = $29,760.45; / 60000
    expect(result.value).toBeCloseTo(0.4960075, 10);
    expect(result.value).toBeLessThan(0.5);
  });

  it('a swap-fee-only case matches a plain single-factor haircut', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 0.01,
      slippageRate: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo((30000 * 0.99) / 60000, 10);
  });
});

/**
 * Composition — V4 Readiness Audit §12 P1-4's own "RATE COMPOSITION"
 * decision: multiplicative `(1 - a) * (1 - b)`, never additive
 * `1 - a - b`. At small rates the two are nearly indistinguishable; this
 * uses rates large enough that an accidental additive implementation
 * would fail this assertion.
 */
describe('calculateBtcPurchasedPerLoop — multiplicative, not additive, composition (P1-5)', () => {
  it('at 1% swap fee / 2% slippage, uses the multiplicative Effective Rate (0.9702), not the additive one (0.97)', () => {
    const result = calculateBtcPurchasedPerLoop(100000, 50000, {
      swapFeeRate: 0.01,
      slippageRate: 0.02,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const multiplicativeExpected = (100000 * 0.9702) / 50000;
    const additiveExpected = (100000 * 0.97) / 50000;
    expect(result.value).toBeCloseTo(multiplicativeExpected, 10);
    expect(result.value).not.toBeCloseTo(additiveExpected, 6);
  });
});

/**
 * Invalid domains — 02_Formulas.md F-070's own "Invalid-Input Behavior":
 * never a silent NaN, Infinity, or negative execution quantity.
 */
describe('calculateBtcPurchasedPerLoop — invalid execution-cost domains (P1-5)', () => {
  it('rejects a negative swapFeeRate', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: -0.01,
      slippageRate: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects a negative slippageRate', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 0,
      slippageRate: -0.01,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects swapFeeRate >= 1', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 1,
      slippageRate: 0,
    });
    expect(result.ok).toBe(false);
  });

  it('rejects slippageRate >= 1', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 0,
      slippageRate: 1,
    });
    expect(result.ok).toBe(false);
  });

  it('never leaks NaN or Infinity even at rates approaching the domain boundary', () => {
    const result = calculateBtcPurchasedPerLoop(30000, 60000, {
      swapFeeRate: 0.999999,
      slippageRate: 0.999999,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.value)).toBe(true);
    expect(Number.isNaN(result.value)).toBe(false);
    expect(result.value).toBeGreaterThanOrEqual(0);
  });
});

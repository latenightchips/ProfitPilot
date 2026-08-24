import { describe, expect, it } from 'vitest';

import { calculateDebtAssetValue } from '@/engine/portfolio/calculateDebtAssetValue';

/**
 * `calculateDebtAssetValue` — V4 Readiness Audit §12 P1-D2. Mirrors
 * `calculateCollateralValue.test.ts`'s own conventions, plus the
 * deliberately non-$1 prices this stage's own instructions call for so
 * an accidental fixed-one implementation cannot pass.
 */
describe('calculateDebtAssetValue (DEBT-ASSET-USD-VALUE)', () => {
  it('10,000 debt tokens at exactly $1.00 = $10,000', () => {
    const result = calculateDebtAssetValue(10000, 1);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(10000);
      expect(result.metadata.formulaId).toBe('DEBT-ASSET-USD-VALUE');
    }
  });

  it('10,000 debt tokens at $0.9973 (below par) = $9,973', () => {
    const result = calculateDebtAssetValue(10000, 0.9973);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(9973);
  });

  it('10,000 debt tokens at $1.0041 (above par) = $10,041', () => {
    const result = calculateDebtAssetValue(10000, 1.0041);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(10041, 10);
  });

  it('returns 0 for zero debt-asset quantity, at any valid price', () => {
    const result = calculateDebtAssetValue(0, 0.9973);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(0);
  });

  it('handles a fractional debt-asset quantity', () => {
    const result = calculateDebtAssetValue(1234.5678, 1.0041);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(1234.5678 * 1.0041, 8);
  });

  it('rejects a negative debt-asset quantity', () => {
    const result = calculateDebtAssetValue(-1, 1);
    expect(result.ok).toBe(false);
  });

  it('rejects a zero debt-asset price — there is no implicit $1 (or any other) fallback', () => {
    const result = calculateDebtAssetValue(10000, 0);
    expect(result.ok).toBe(false);
  });

  it('rejects a negative debt-asset price', () => {
    const result = calculateDebtAssetValue(10000, -0.5);
    expect(result.ok).toBe(false);
  });

  it('is deterministic: repeated calls with the same inputs produce identical financial/result content (excluding the per-call metadata.timestamp, which is runtime metadata, not a financial output)', () => {
    const first = calculateDebtAssetValue(9999.99, 0.9973);
    const second = calculateDebtAssetValue(9999.99, 0.9973);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(second.value).toBe(first.value);
    expect(second.warnings).toEqual(first.warnings);
    expect(second.metadata.formulaId).toBe(first.metadata.formulaId);
    expect(second.metadata.formulaVersion).toBe(first.metadata.formulaVersion);
    expect(second.metadata.engineVersion).toBe(first.metadata.engineVersion);
    expect(second.metadata.assumptions).toEqual(first.metadata.assumptions);
    expect(second.metadata.inputsUsed).toEqual(first.metadata.inputsUsed);
  });

  it('never defaults debtAssetPriceUsd to 1 when a genuinely different price is supplied', () => {
    const atOne = calculateDebtAssetValue(10000, 1);
    const atNonOne = calculateDebtAssetValue(10000, 1.0041);
    expect(atOne.ok).toBe(true);
    expect(atNonOne.ok).toBe(true);
    if (atOne.ok && atNonOne.ok) {
      expect(atNonOne.value).not.toBe(atOne.value);
    }
  });
});

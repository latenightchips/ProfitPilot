import { describe, expect, it } from 'vitest';

import {
  calculateAvailableBorrow,
  calculateBorrowCapacity,
  calculateMaximumBorrowLimit,
} from '@/engine/loop/calculateBorrowCapacity';

describe('calculateBorrowCapacity (F-012)', () => {
  it('matches the documented example: collateral $100,000, LTV 70% = $70,000', () => {
    const result = calculateBorrowCapacity(100000, 0.7);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(70000);
      expect(result.metadata.formulaId).toBe('F-012');
    }
  });

  it('matches Scenario C from the Leverage & Loop unit test examples: collateral $120,000, LTV 70% = $84,000', () => {
    const result = calculateBorrowCapacity(120000, 0.7);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(84000);
  });

  it('rejects an out-of-range LTV', () => {
    expect(calculateBorrowCapacity(100000, 1.5).ok).toBe(false);
  });

  it('rejects negative collateral value', () => {
    const result = calculateBorrowCapacity(-1, 0.7);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });
});

describe('calculateMaximumBorrowLimit (F-021)', () => {
  it('matches the documented example: collateral $100,000, protocol LTV 70% = $70,000', () => {
    const result = calculateMaximumBorrowLimit(100000, 0.7);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(70000);
      expect(result.metadata.formulaId).toBe('F-021');
    }
  });

  it('computes the same value as calculateBorrowCapacity for identical inputs', () => {
    const capacity = calculateBorrowCapacity(100000, 0.7);
    const limit = calculateMaximumBorrowLimit(100000, 0.7);
    expect(capacity.ok && limit.ok && capacity.value === limit.value).toBe(true);
  });

  it('rejects an out-of-range LTV', () => {
    const result = calculateMaximumBorrowLimit(100000, 1.5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_PERCENTAGE');
  });
});

describe('calculateAvailableBorrow (F-013)', () => {
  it('matches the documented example: capacity $70,000, debt $45,000 = $25,000', () => {
    const result = calculateAvailableBorrow(100000, 0.7, 45000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(25000);
      expect(result.metadata.formulaId).toBe('F-013');
      expect(result.warnings).toEqual([]);
    }
  });

  it('warns when current debt exceeds borrow capacity', () => {
    const result = calculateAvailableBorrow(100000, 0.7, 80000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(-10000);
      expect(result.warnings.some((w) => w.code === 'BORROW_CAPACITY_EXCEEDED')).toBe(true);
    }
  });

  it('propagates a failure from an invalid protocol parameter', () => {
    const result = calculateAvailableBorrow(100000, 1.5, 0);
    expect(result.ok).toBe(false);
  });

  it('rejects a negative currentDebt', () => {
    const result = calculateAvailableBorrow(100000, 0.7, -1);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });
});

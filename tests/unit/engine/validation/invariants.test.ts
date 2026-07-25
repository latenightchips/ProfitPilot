import { describe, expect, it } from 'vitest';

import {
  checkAllocationInvariant,
  checkFullRepaymentInvariant,
  checkLoopReconciliationInvariant,
  checkNetWorthInvariant,
  checkTargetHealthFactorInvariant,
} from '@/engine/validation/invariants';

describe('checkNetWorthInvariant', () => {
  it('passes when net worth equals collateral minus debt', () => {
    expect(checkNetWorthInvariant(120000, 30000, 90000)).toBe(true);
  });

  it('fails when net worth does not equal collateral minus debt', () => {
    expect(checkNetWorthInvariant(120000, 30000, 80000)).toBe(false);
  });
});

describe('checkAllocationInvariant', () => {
  it('passes when collateral value equals portfolio value (single-asset 100%)', () => {
    expect(checkAllocationInvariant(120000, 120000)).toBe(true);
  });

  it('fails when collateral value does not equal portfolio value', () => {
    expect(checkAllocationInvariant(100000, 120000)).toBe(false);
  });

  it('passes for a zero-value portfolio with zero collateral', () => {
    expect(checkAllocationInvariant(0, 0)).toBe(true);
  });
});

describe('checkTargetHealthFactorInvariant', () => {
  it('passes when the resulting Health Factor reproduces the target', () => {
    expect(checkTargetHealthFactorInvariant(2.0, 2.0)).toBe(true);
  });

  it('fails when the resulting Health Factor diverges from the target', () => {
    expect(checkTargetHealthFactorInvariant(1.8, 2.0)).toBe(false);
  });
});

describe('checkLoopReconciliationInvariant', () => {
  it('passes when final totals equal the sum of initial state plus every step', () => {
    const result = checkLoopReconciliationInvariant(1, 1.35, [0.35], 0, 21000, [21000]);
    expect(result).toBe(true);
  });

  it('passes across multiple steps', () => {
    const result = checkLoopReconciliationInvariant(
      1,
      1.9,
      [0.35, 0.3, 0.25],
      0,
      54000,
      [21000, 18000, 15000],
    );
    expect(result).toBe(true);
  });

  it('fails when the final collateral quantity does not reconcile', () => {
    const result = checkLoopReconciliationInvariant(1, 2, [0.35], 0, 21000, [21000]);
    expect(result).toBe(false);
  });

  it('fails when the final debt does not reconcile', () => {
    const result = checkLoopReconciliationInvariant(1, 1.35, [0.35], 0, 99999, [21000]);
    expect(result).toBe(false);
  });
});

describe('checkFullRepaymentInvariant', () => {
  it('passes when remaining debt is exactly zero', () => {
    expect(checkFullRepaymentInvariant(0)).toBe(true);
  });

  it('fails when remaining debt is nonzero', () => {
    expect(checkFullRepaymentInvariant(0.01)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { deriveAaveV4DebtAfterRepayment } from '@/engine/protocols/aaveV4/deriveDebtAfterRepayment';

/**
 * `deriveAaveV4DebtAfterRepayment` — V4 Readiness Audit §12 Stage 12.
 * Every expected value below is derived directly from
 * `aave/aave-v4`'s `UserPositionUtils.sol#calculateRestoreAmount` three
 * branches (see this formula's own header comment for the exact Solidity
 * quoted): premium debt is repaid FIRST, then drawn debt with the
 * remainder — never proportionally, never drawn-first.
 */
describe('deriveAaveV4DebtAfterRepayment — premium-first allocation (aave-v4 UserPositionUtils.calculateRestoreAmount parity)', () => {
  it('zero repaymentAmount leaves both streams unchanged (a genuine no-op)', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 0,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(15000);
    expect(result.value.premiumDebt).toBe(5000);
    expect(result.value.totalDebt).toBe(20000);
  });

  it('an exact full repayment (amount === total debt) clears both streams to zero', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 20000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(0);
    expect(result.value.premiumDebt).toBe(0);
    expect(result.value.totalDebt).toBe(0);
  });

  it('an over-repayment (amount > total debt) also clears both streams to zero, capped exactly like the Solidity "amount >= total" branch', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 999999,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(0);
    expect(result.value.premiumDebt).toBe(0);
  });

  it('a partial repayment smaller than premiumDebt reduces ONLY premiumDebt — drawnDebt is completely untouched (Solidity "amount < premiumDebt" branch)', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 2000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(15000);
    expect(result.value.premiumDebt).toBe(3000);
    expect(result.value.totalDebt).toBe(18000);
  });

  it('a repayment exactly equal to premiumDebt fully clears premium and leaves drawnDebt untouched (the exact boundary between the two partial-repay branches)', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 5000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(15000);
    expect(result.value.premiumDebt).toBe(0);
  });

  it('a repayment larger than premiumDebt but smaller than total fully clears premium and applies the remainder to drawnDebt (Solidity "else" branch)', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 12000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // premiumDebt fully cleared (5000); remainder (12000 - 5000 = 7000)
    // reduces drawnDebt: 15000 - 7000 = 8000.
    expect(result.value.drawnDebt).toBe(8000);
    expect(result.value.premiumDebt).toBe(0);
    expect(result.value.totalDebt).toBe(8000);
  });

  it('a position with premiumDebt already at 0 applies the entire repayment to drawnDebt directly', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 0,
      repaymentAmount: 5000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(10000);
    expect(result.value.premiumDebt).toBe(0);
  });

  it('a position with drawnDebt already at 0 (all remaining debt is premium) applies the repayment straight to premiumDebt', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 0,
      premiumDebt: 5000,
      repaymentAmount: 3000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBe(0);
    expect(result.value.premiumDebt).toBe(2000);
  });

  it('totalDebt always equals the sum of drawnDebt and premiumDebt (no fabricated blended figure)', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 7500,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.totalDebt).toBeCloseTo(
      result.value.drawnDebt + result.value.premiumDebt,
      9,
    );
  });

  it('the formula metadata identifies this as its own distinct formula, not a reuse of AAVE-V4-DRAWN-PREMIUM', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: 1000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.formulaId).toBe('AAVE-V4-REPAYMENT-ALLOCATION');
  });

  it('rejects a negative drawnDebt balance', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: -1,
      premiumDebt: 0,
      repaymentAmount: 100,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative premiumDebt balance', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: -1,
      repaymentAmount: 100,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects a negative repaymentAmount', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 15000,
      premiumDebt: 5000,
      repaymentAmount: -1,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_NON_NEGATIVE');
  });

  it('rejects NaN input rather than propagating it', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: NaN,
      premiumDebt: 0,
      repaymentAmount: 100,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INVALID_FINITE');
  });

  it('never returns NaN or Infinity for any valid input', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 26000,
      premiumDebt: 500,
      repaymentAmount: 10000,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(Number.isFinite(result.value.drawnDebt)).toBe(true);
    expect(Number.isFinite(result.value.premiumDebt)).toBe(true);
    expect(Number.isFinite(result.value.totalDebt)).toBe(true);
  });

  it('neither drawnDebt nor premiumDebt ever goes negative, even for values requiring careful capping', () => {
    const result = deriveAaveV4DebtAfterRepayment({
      drawnDebt: 100,
      premiumDebt: 50,
      repaymentAmount: 149.999999,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.drawnDebt).toBeGreaterThanOrEqual(0);
    expect(result.value.premiumDebt).toBeGreaterThanOrEqual(0);
  });
});

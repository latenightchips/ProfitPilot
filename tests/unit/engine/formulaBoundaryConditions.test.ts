import { describe, expect, it } from 'vitest';

import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';
import { calculateAnnualInterest } from '@/engine/interest/calculateAnnualInterest';
import { calculateDailyInterest } from '@/engine/interest/calculateDailyInterest';
import { calculateLiquidationPrice } from '@/engine/liquidation/calculateLiquidationPrice';
import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import { calculateLoanToValue } from '@/engine/portfolio/calculateLoanToValue';

/**
 * Formula boundary condition tests — 06_TASKS.md M9-008 ("Test Formula
 * Boundary Conditions"). Include: zero debt, zero collateral, very small
 * balances, very large balances, Health Factor near one, Health Factor
 * exactly one where valid, zero interest, extreme interest rate, maximum
 * LTV boundary, liquidation threshold boundary, infeasible exit target,
 * loop stop conditions.
 *
 * Most of these 12 conditions already have dedicated coverage elsewhere,
 * confirmed by direct inspection before writing this file, not assumed:
 *   - Zero debt / zero collateral: broadly covered across
 *     tests/unit/engine/{health,liquidation,portfolio}/*.test.ts and the
 *     invariants/ suite.
 *   - Health Factor near one / exactly one, liquidation threshold
 *     boundary: tests/unit/engine/criticalRiskBoundaryRegression.test.ts
 *     (M2-029).
 *   - Zero interest: tests/unit/engine/interest/*.test.ts,
 *     loop/calculateLoopStrategy.test.ts, and several recommendation
 *     tests.
 *   - Maximum LTV boundary: criticalRiskBoundaryRegression.test.ts's
 *     "Available Borrow equals exactly 0" case.
 *   - Infeasible exit target: tests/unit/engine/exit/calculateExitPosition.test.ts
 *     ('INSUFFICIENT_COLLATERAL', 'INVALID_TARGET_DEBT').
 *   - Loop stop conditions: tests/unit/engine/loop/calculateLoopStrategy.test.ts
 *     and invariants/loopReconciliationInvariant.test.ts
 *     (MIN_HEALTH_FACTOR_REACHED, MAX_LOOPS_REACHED).
 *
 * This file adds only the 3 conditions a direct audit found genuinely
 * untested anywhere in the existing suite: very small balances, very
 * large balances, and extreme interest rate. Expected values were
 * derived independently (Python `decimal`, shown per test) rather than
 * copied from a live Engine run.
 */
describe('Formula boundary conditions (M9-008)', () => {
  describe('Very small balances', () => {
    /**
     * Independent derivation: 0.00000001 BTC * $50,000 = $0.0005;
     * HF = (0.0005 * 0.8) / 0.01 = 0.04; LTV = 0.01 / 0.0005 = 20.
     */
    it('a near-dust collateral quantity (1 satoshi) computes without throwing and produces documented values', () => {
      const collateral = { asset: 'BTC' as const, quantity: 0.00000001 };
      const market = { btcPriceUsd: 50000 };

      const collateralValueResult = calculateCollateralValue(collateral, market);
      expect(collateralValueResult.ok).toBe(true);
      if (!collateralValueResult.ok) return;
      expect(collateralValueResult.value).toBeCloseTo(0.0005, 8);

      const healthFactorResult = calculateHealthFactor(collateralValueResult.value, 0.8, 0.01);
      expect(healthFactorResult.ok).toBe(true);
      if (healthFactorResult.ok) {
        expect(healthFactorResult.value).toBeCloseTo(0.04, 6);
      }

      const ltvResult = calculateLoanToValue(0.01, collateralValueResult.value);
      expect(ltvResult.ok).toBe(true);
      if (ltvResult.ok) {
        expect(ltvResult.value).toBeCloseTo(20, 6);
      }
    });

    it('a near-dust debt balance (a fraction of one cent) computes without throwing', () => {
      const result = calculateHealthFactor(100000, 0.8, 0.0000001);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeGreaterThan(0);
        expect(Number.isFinite(result.value)).toBe(true);
      }
    });
  });

  describe('Very large balances', () => {
    /**
     * Independent derivation: 100,000 BTC * $50,000 = $5,000,000,000;
     * HF = ($5B * 0.8) / $3B = 1.3333...; LTV = $3B / $5B = 0.6.
     */
    it('a very large collateral quantity (100,000 BTC) computes without throwing and produces documented values', () => {
      const collateral = { asset: 'BTC' as const, quantity: 100000 };
      const market = { btcPriceUsd: 50000 };

      const collateralValueResult = calculateCollateralValue(collateral, market);
      expect(collateralValueResult.ok).toBe(true);
      if (!collateralValueResult.ok) return;
      expect(collateralValueResult.value).toBeCloseTo(5000000000, 2);

      const debtValue = 3000000000;

      const healthFactorResult = calculateHealthFactor(collateralValueResult.value, 0.8, debtValue);
      expect(healthFactorResult.ok).toBe(true);
      if (healthFactorResult.ok) {
        expect(healthFactorResult.value).toBeCloseTo(1.333333333333, 6);
      }

      const ltvResult = calculateLoanToValue(debtValue, collateralValueResult.value);
      expect(ltvResult.ok).toBe(true);
      if (ltvResult.ok) {
        expect(ltvResult.value).toBeCloseTo(0.6, 6);
      }

      const liquidationPriceResult = calculateLiquidationPrice(
        market.btcPriceUsd,
        debtValue,
        collateralValueResult.value,
        0.8,
      );
      expect(liquidationPriceResult.ok).toBe(true);
      if (liquidationPriceResult.ok) {
        expect(Number.isFinite(liquidationPriceResult.value)).toBe(true);
      }
    });

    it('a very large debt balance computes annual interest without throwing', () => {
      const result = calculateAnnualInterest(9000000000, 0.05);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeCloseTo(450000000, 2);
      }
    });
  });

  describe('Extreme interest rate', () => {
    /**
     * Independent derivation: $100,000 debt at 500% APR ->
     * annual = $100,000 * 5.0 = $500,000;
     * daily = $500,000 / 365 = $1,369.863013698630...
     */
    it('a 500% APR computes annual and daily interest without throwing, proportional to the rate', () => {
      const debtValue = 100000;
      const extremeApr = 5.0;

      const annualResult = calculateAnnualInterest(debtValue, extremeApr);
      expect(annualResult.ok).toBe(true);
      if (annualResult.ok) {
        expect(annualResult.value).toBeCloseTo(500000, 2);
      }

      const dailyResult = calculateDailyInterest(debtValue, extremeApr);
      expect(dailyResult.ok).toBe(true);
      if (dailyResult.ok) {
        expect(dailyResult.value).toBeCloseTo(1369.86301369863, 6);
      }
    });

    it('does not reject an APR above 100% (validateRate documents no upper bound)', () => {
      const result = calculateAnnualInterest(1000, 10);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeCloseTo(10000, 2);
      }
    });
  });
});

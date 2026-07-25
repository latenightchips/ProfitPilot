import { describe, expect, it } from 'vitest';

import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';
import { calculateAnnualInterest } from '@/engine/interest/calculateAnnualInterest';
import { calculateDailyInterest } from '@/engine/interest/calculateDailyInterest';
import { calculateMonthlyInterest } from '@/engine/interest/calculateMonthlyInterest';
import { calculateLiquidationBuffer } from '@/engine/liquidation/calculateLiquidationBuffer';
import { calculateLiquidationDistance } from '@/engine/liquidation/calculateLiquidationDistance';
import { calculateLiquidationPrice } from '@/engine/liquidation/calculateLiquidationPrice';
import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import { calculateDebtRatio } from '@/engine/portfolio/calculateDebtRatio';
import { calculateDebtValue } from '@/engine/portfolio/calculateDebtValue';
import { calculateEffectiveLeverage } from '@/engine/portfolio/calculateEffectiveLeverage';
import { calculateExposure } from '@/engine/portfolio/calculateExposure';
import { calculateLoanToValue } from '@/engine/portfolio/calculateLoanToValue';
import { calculateNetWorth } from '@/engine/portfolio/calculateNetWorth';
import { calculatePortfolioValue } from '@/engine/portfolio/calculatePortfolioValue';

import {
  ACCEPTABLE_ERROR,
  GOLDEN_REFERENCE_PORTFOLIOS,
} from '../../fixtures/goldenReferencePortfolios';

/**
 * Golden Reference Portfolio verification — 06_TASKS.md M2-028.
 *
 * Each fixture's `expected` values were derived independently (see
 * tests/fixtures/goldenReferencePortfolios.ts's file-level comment), not
 * copied from these function calls. Comparisons use 02_Formulas.md's own
 * "ACCEPTABLE ERROR" tolerances rather than exact equality, exactly as
 * that table specifies.
 */
describe('Golden Reference Portfolios (M2-028)', () => {
  it.each(GOLDEN_REFERENCE_PORTFOLIOS)(
    '$name: matches every manually-verified metric',
    (fixture) => {
      const { portfolio, expected } = fixture;

      const collateralValueResult = calculateCollateralValue(
        portfolio.collateral,
        portfolio.market,
      );
      expect(collateralValueResult.ok).toBe(true);
      if (collateralValueResult.ok) {
        expect(collateralValueResult.value).toBeCloseTo(expected.collateralValue, 2);
      }

      const portfolioValueResult = calculatePortfolioValue(portfolio.collateral, portfolio.market);
      expect(portfolioValueResult.ok).toBe(true);
      if (portfolioValueResult.ok) {
        expect(portfolioValueResult.value).toBeCloseTo(expected.portfolioValue, 2);
      }

      const debtValueResult = calculateDebtValue(portfolio.debt);
      expect(debtValueResult.ok).toBe(true);
      if (debtValueResult.ok) {
        expect(debtValueResult.value).toBeCloseTo(expected.debtValue, 2);
      }

      const netWorthResult = calculateNetWorth(portfolio);
      expect(netWorthResult.ok).toBe(true);
      if (netWorthResult.ok) {
        expect(netWorthResult.value).toBeCloseTo(expected.netWorth, 2);
      }

      const ltvResult = calculateLoanToValue(expected.debtValue, expected.collateralValue);
      expect(ltvResult.ok).toBe(true);
      if (ltvResult.ok) {
        expect(ltvResult.value).toBeCloseTo(expected.loanToValue, 4);
      }

      const debtRatioResult = calculateDebtRatio(expected.debtValue, expected.portfolioValue);
      expect(debtRatioResult.ok).toBe(true);
      if (debtRatioResult.ok) {
        expect(debtRatioResult.value).toBeCloseTo(expected.debtRatio, 4);
      }

      const exposureResult = calculateExposure(portfolio.collateral, portfolio.market);
      expect(exposureResult.ok).toBe(true);
      if (exposureResult.ok) {
        expect(exposureResult.value).toBeCloseTo(expected.exposure, 2);
      }

      const leverageResult = calculateEffectiveLeverage(portfolio);
      expect(leverageResult.ok).toBe(true);
      if (leverageResult.ok) {
        expect(leverageResult.value).toBeCloseTo(expected.effectiveLeverage, 4);
      }

      const healthFactorResult = calculateHealthFactor(
        expected.collateralValue,
        portfolio.protocol.liquidationThreshold,
        expected.debtValue,
      );
      expect(healthFactorResult.ok).toBe(true);
      if (healthFactorResult.ok) {
        if (expected.healthFactor === Infinity) {
          expect(healthFactorResult.value).toBe(Infinity);
        } else {
          expect(healthFactorResult.value).toBeCloseTo(
            expected.healthFactor,
            Math.round(-Math.log10(ACCEPTABLE_ERROR.healthFactor)),
          );
        }
      }

      const liquidationDistanceResult = calculateLiquidationDistance(
        expected.collateralValue,
        portfolio.protocol.liquidationThreshold,
        expected.debtValue,
      );
      expect(liquidationDistanceResult.ok).toBe(true);
      if (liquidationDistanceResult.ok) {
        if (expected.liquidationDistance === Infinity) {
          expect(liquidationDistanceResult.value).toBe(Infinity);
        } else {
          expect(liquidationDistanceResult.value).toBeCloseTo(expected.liquidationDistance, 3);
        }
      }

      const liquidationPriceResult = calculateLiquidationPrice(
        portfolio.market.btcPriceUsd,
        expected.debtValue,
        expected.collateralValue,
        portfolio.protocol.liquidationThreshold,
      );
      if (expected.liquidationPrice === null) {
        expect(liquidationPriceResult.ok).toBe(false);
        if (!liquidationPriceResult.ok) {
          expect(liquidationPriceResult.error.code).toBe('NOT_APPLICABLE_NO_DEBT');
        }
      } else {
        expect(liquidationPriceResult.ok).toBe(true);
        if (liquidationPriceResult.ok) {
          expect(liquidationPriceResult.value).toBeCloseTo(expected.liquidationPrice, 2);
        }
      }

      const liquidationBufferResult = calculateLiquidationBuffer(
        portfolio.market.btcPriceUsd,
        expected.debtValue,
        expected.collateralValue,
        portfolio.protocol.liquidationThreshold,
      );
      if (expected.liquidationBuffer === null) {
        expect(liquidationBufferResult.ok).toBe(false);
        if (!liquidationBufferResult.ok) {
          expect(liquidationBufferResult.error.code).toBe('NOT_APPLICABLE_NO_DEBT');
        }
      } else {
        expect(liquidationBufferResult.ok).toBe(true);
        if (liquidationBufferResult.ok) {
          expect(liquidationBufferResult.value).toBeCloseTo(expected.liquidationBuffer, 2);
        }
      }

      const annualInterestResult = calculateAnnualInterest(
        expected.debtValue,
        portfolio.protocol.borrowApr,
      );
      expect(annualInterestResult.ok).toBe(true);
      if (annualInterestResult.ok) {
        expect(annualInterestResult.value).toBeCloseTo(expected.annualInterest, 2);
      }

      const dailyInterestResult = calculateDailyInterest(
        expected.debtValue,
        portfolio.protocol.borrowApr,
      );
      expect(dailyInterestResult.ok).toBe(true);
      if (dailyInterestResult.ok) {
        expect(dailyInterestResult.value).toBeCloseTo(expected.dailyInterest, 2);
      }

      const monthlyInterestResult = calculateMonthlyInterest(
        expected.debtValue,
        portfolio.protocol.borrowApr,
      );
      expect(monthlyInterestResult.ok).toBe(true);
      if (monthlyInterestResult.ok) {
        expect(monthlyInterestResult.value).toBeCloseTo(expected.monthlyInterest, 2);
      }
    },
  );

  it("NO_DEBT fixture reproduces 02_Formulas.md's official Golden Reference Portfolio pre-loop state exactly", () => {
    const noDebt = GOLDEN_REFERENCE_PORTFOLIOS.find((f) => f.name === 'No debt');
    expect(noDebt).toBeDefined();
    if (!noDebt) return;

    expect(noDebt.portfolio.collateral.quantity).toBe(3.33333333);
    expect(noDebt.portfolio.market.btcPriceUsd).toBe(30000);
    expect(noDebt.portfolio.protocol.maxLoanToValue).toBe(0.7);
    expect(noDebt.portfolio.protocol.liquidationThreshold).toBe(0.8);
    expect(noDebt.portfolio.protocol.borrowApr).toBe(0.05);
  });

  it('every fixture beyond NO_DEBT shares identical collateral, price, and protocol parameters', () => {
    const [noDebt, ...rest] = GOLDEN_REFERENCE_PORTFOLIOS;
    for (const fixture of rest) {
      expect(fixture.portfolio.collateral.quantity).toBe(noDebt.portfolio.collateral.quantity);
      expect(fixture.portfolio.market.btcPriceUsd).toBe(noDebt.portfolio.market.btcPriceUsd);
      expect(fixture.portfolio.protocol).toEqual(noDebt.portfolio.protocol);
    }
  });
});

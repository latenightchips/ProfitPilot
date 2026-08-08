import { describe, expect, it } from 'vitest';

import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';
import { calculateLiquidationBuffer } from '@/engine/liquidation/calculateLiquidationBuffer';
import { calculateLiquidationDistance } from '@/engine/liquidation/calculateLiquidationDistance';
import { calculateLiquidationPrice } from '@/engine/liquidation/calculateLiquidationPrice';
import { calculateLoopStrategy } from '@/engine/loop/calculateLoopStrategy';
import { calculateCollateralValue } from '@/engine/portfolio/calculateCollateralValue';
import { calculateDebtRatio } from '@/engine/portfolio/calculateDebtRatio';
import { calculateDebtValue } from '@/engine/portfolio/calculateDebtValue';
import { calculateEffectiveLeverage } from '@/engine/portfolio/calculateEffectiveLeverage';
import { calculateExposure } from '@/engine/portfolio/calculateExposure';
import { calculateLoanToValue } from '@/engine/portfolio/calculateLoanToValue';
import { calculateNetWorth } from '@/engine/portfolio/calculateNetWorth';
import { calculatePortfolioValue } from '@/engine/portfolio/calculatePortfolioValue';
import {
  generateRecommendations,
  type RecommendationRuleConfig,
} from '@/engine/recommendation/generateRecommendations';
import type { ScenarioSummary } from '@/engine/simulation/compareScenarios';
import { compareScenarios } from '@/engine/simulation/compareScenarios';
import { simulatePositionChange } from '@/engine/simulation/simulatePositionChange';
import { simulatePriceScenario } from '@/engine/simulation/simulatePriceScenario';

import { GOLDEN_REFERENCE_PORTFOLIOS } from '../fixtures/goldenReferencePortfolios';

/**
 * Engine Performance Benchmarks — 06_TASKS.md M2-030 ("Benchmark Engine
 * Performance").
 *
 * Targets come from `04_BUILD_GUIDE.md`'s dedicated "PERFORMANCE TESTS"
 * section ("Benchmark critical calculations" / "Targets"), the section
 * M2-030's own DoD names by pointing at "the Build Guide" specifically —
 * not `02_Formulas.md`'s own, differently-numbered "PERFORMANCE TARGETS"
 * section (see PROJECT_STATUS.md conflict #16). The 4 Build Guide targets
 * used here, verbatim:
 *   - Single portfolio calculation: < 10ms
 *   - Optimal loop calculation:     < 20ms
 *   - Standard simulation:          < 50ms
 *   - Recommendation evaluation:    < 20ms
 *
 * **"Recommendation evaluation" added in Milestone 9 Batch 7 (M9-040
 * "Optimize Formula and Service Execution")** — M2-030's own "Benchmark"
 * list never named a recommendation category, so this 4th Build Guide
 * target went unbenchmarked from M2-030 through Milestone 9 Batch 6.
 * M9-040's own Focus list names "Recommendation recalculation"
 * explicitly; closing the gap is a genuine, narrow audit finding (a
 * missing benchmark for an already-documented target), not a
 * newly-invented threshold.
 *
 * M2-030 names 6 benchmark targets (Portfolio summary, Health Factor,
 * Liquidation calculations, Loop strategy, Single scenario, Scenario
 * comparison); the Build Guide only defines 4 categories. "Health Factor"
 * and "Liquidation calculations" are mapped to "Single portfolio
 * calculation" (< 10ms) — both are steps in `02_Formulas.md`'s own
 * FORMULA DEPENDENCY GRAPH chain that starts at "Portfolio Value" — and
 * "Scenario comparison" is mapped to "Standard simulation" (< 50ms), the
 * closest documented category. No new number is introduced anywhere in
 * this file — every asserted threshold is one of the 3 values above,
 * reused for the M2-030 item that most plausibly falls under it. See
 * PROJECT_STATUS.md conflict #16 for the full reasoning.
 *
 * Methodology ("Performance tests should run using representative
 * inputs," 04_BUILD_GUIDE.md "PERFORMANCE TESTS"): each benchmark uses a
 * real Golden Reference Portfolio (M2-028) as its input, runs a warmup
 * pass to avoid JIT-compilation skew, then measures the median of many
 * timed calls — more robust against a single unlucky scheduling pause
 * than a single cold-start measurement, without inflating or shrinking
 * the documented thresholds themselves.
 */

const WARMUP_ITERATIONS = 20;
const MEASURED_ITERATIONS = 200;

function medianDurationMs(fn: () => void): number {
  for (let i = 0; i < WARMUP_ITERATIONS; i += 1) fn();

  const durations: number[] = [];
  for (let i = 0; i < MEASURED_ITERATIONS; i += 1) {
    const start = performance.now();
    fn();
    durations.push(performance.now() - start);
  }

  durations.sort((a, b) => a - b);
  const mid = Math.floor(durations.length / 2);
  return durations.length % 2 === 0 ? (durations[mid - 1] + durations[mid]) / 2 : durations[mid];
}

const moderateLeverage = GOLDEN_REFERENCE_PORTFOLIOS.find(
  (fixture) => fixture.name === 'Moderate leverage',
);
const noDebt = GOLDEN_REFERENCE_PORTFOLIOS.find((fixture) => fixture.name === 'No debt');

if (!moderateLeverage || !noDebt) {
  throw new Error('Expected Golden Reference Portfolio fixtures were not found.');
}

const { portfolio } = moderateLeverage;

describe('Engine Performance Benchmarks (M2-030)', () => {
  it('Portfolio summary: full portfolio metrics suite < 10ms (Build Guide "Single portfolio calculation")', () => {
    const duration = medianDurationMs(() => {
      const collateralValue = calculateCollateralValue(portfolio.collateral, portfolio.market);
      const debtValue = calculateDebtValue(portfolio.debt);
      const portfolioValue = calculatePortfolioValue(portfolio.collateral, portfolio.market);
      const netWorth = calculateNetWorth(portfolio);
      const exposure = calculateExposure(portfolio.collateral, portfolio.market);
      const leverage = calculateEffectiveLeverage(portfolio);
      if (!collateralValue.ok || !debtValue.ok || !portfolioValue.ok) return;
      calculateLoanToValue(debtValue.value, collateralValue.value);
      calculateDebtRatio(debtValue.value, portfolioValue.value);
      if (!netWorth.ok || !exposure.ok || !leverage.ok) return;
    });

    expect(duration).toBeLessThan(10);
  });

  it('Health Factor < 10ms (mapped to Build Guide "Single portfolio calculation" — see file header)', () => {
    const duration = medianDurationMs(() => {
      calculateHealthFactor(
        99999.9999,
        portfolio.protocol.liquidationThreshold,
        portfolio.debt.balance,
      );
    });

    expect(duration).toBeLessThan(10);
  });

  it('Liquidation calculations < 10ms (mapped to Build Guide "Single portfolio calculation" — see file header)', () => {
    const duration = medianDurationMs(() => {
      const price = calculateLiquidationPrice(
        portfolio.market.btcPriceUsd,
        portfolio.debt.balance,
        99999.9999,
        portfolio.protocol.liquidationThreshold,
      );
      calculateLiquidationDistance(
        99999.9999,
        portfolio.protocol.liquidationThreshold,
        portfolio.debt.balance,
      );
      if (!price.ok) return;
      calculateLiquidationBuffer(
        portfolio.market.btcPriceUsd,
        portfolio.debt.balance,
        99999.9999,
        portfolio.protocol.liquidationThreshold,
      );
    });

    expect(duration).toBeLessThan(10);
  });

  it('Loop strategy < 20ms (Build Guide "Optimal loop calculation")', () => {
    const duration = medianDurationMs(() => {
      calculateLoopStrategy({
        collateral: noDebt.portfolio.collateral,
        debt: noDebt.portfolio.debt,
        market: noDebt.portfolio.market,
        protocol: noDebt.portfolio.protocol,
        targetBorrowPercentage: 0.9,
        maxLoops: 10,
        minHealthFactor: 1.5,
      });
    });

    expect(duration).toBeLessThan(20);
  });

  it('Single scenario (price) < 50ms (Build Guide "Standard simulation")', () => {
    const duration = medianDurationMs(() => {
      simulatePriceScenario({
        portfolio,
        scenario: { type: 'percentageChange', percentageChange: -0.1 },
      });
    });

    expect(duration).toBeLessThan(50);
  });

  it('Single scenario (position change) < 50ms (Build Guide "Standard simulation")', () => {
    const duration = medianDurationMs(() => {
      simulatePositionChange({
        portfolio,
        collateralDelta: 0.1,
        debtDelta: 5000,
      });
    });

    expect(duration).toBeLessThan(50);
  });

  it('Scenario comparison < 50ms (mapped to Build Guide "Standard simulation" — see file header)', () => {
    const scenarioA: ScenarioSummary = {
      label: 'Baseline',
      equity: 54999.9999,
      profitOrLoss: 0,
      healthFactor: 1.777777776,
      liquidationDistance: 0.777777776,
      debtCost: 2250,
      leverage: 1.8181818196694215,
    };
    const scenarioB: ScenarioSummary = {
      label: 'Scenario',
      equity: 60000,
      profitOrLoss: 5000.0001,
      healthFactor: 2.0,
      liquidationDistance: 1.0,
      debtCost: 2250,
      leverage: 1.7,
    };

    const duration = medianDurationMs(() => {
      compareScenarios(scenarioA, scenarioB);
    });

    expect(duration).toBeLessThan(50);
  });

  it('Recommendation evaluation < 20ms (Build Guide "Recommendation evaluation", M9-040)', () => {
    const rules: RecommendationRuleConfig = {
      borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
      repayment: { targetHealthFactor: 2.0 },
      additionalCollateral: { targetHealthFactor: 4.0 },
      loop: {
        targetHealthFactor: 1.5,
        loopBorrowPercentage: 0.5,
        maxAcceptableAnnualInterestCost: 5000,
      },
    };

    const duration = medianDurationMs(() => {
      generateRecommendations({ portfolio, rules });
    });

    expect(duration).toBeLessThan(20);
  });
});

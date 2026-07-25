import { describe, expect, it } from 'vitest';

import { calculateTargetExit } from '@/engine/exit/calculateTargetExit';
import { calculateAdditionalBorrow } from '@/engine/health/calculateAdditionalBorrow';
import { calculateHealthFactor } from '@/engine/health/calculateHealthFactor';
import { calculateAdditionalCollateralRecommendation } from '@/engine/recommendation/calculateAdditionalCollateralRecommendation';
import { calculateRepaymentRecommendation } from '@/engine/recommendation/calculateRepaymentRecommendation';
import type { PortfolioInput } from '@/engine/shared/types';
import { checkTargetHealthFactorInvariant } from '@/engine/validation/invariants';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

/**
 * 06_TASKS.md M2-027 invariant: "Target Health Factor results reproduce
 * the target." Checked across every already-implemented function that
 * accepts a target Health Factor, not just the one internal self-check
 * `calculateAdditionalBorrow` (F-027) already performs.
 */
describe('Engine invariant: Target Health Factor results reproduce the target (M2-027)', () => {
  it('holds for calculateAdditionalBorrow (F-027)', () => {
    const collateralValue = 100000;
    const threshold = 0.8;
    const currentDebt = 60000;
    const targetHealthFactor = 2.0;

    const result = calculateAdditionalBorrow(
      collateralValue,
      threshold,
      currentDebt,
      targetHealthFactor,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resultingDebt = currentDebt + result.value;
    const resultingHf = calculateHealthFactor(collateralValue, threshold, resultingDebt);
    expect(resultingHf.ok).toBe(true);
    if (!resultingHf.ok) return;

    expect(checkTargetHealthFactorInvariant(resultingHf.value, targetHealthFactor)).toBe(true);
  });

  it('holds for calculateRepaymentRecommendation (F-062)', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const targetHealthFactor = 2.0;

    const result = calculateRepaymentRecommendation({ portfolio, targetHealthFactor });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resultingHf = calculateHealthFactor(
      120000,
      protocol.liquidationThreshold,
      result.value.relevantValues.targetDebt,
    );
    expect(resultingHf.ok).toBe(true);
    if (!resultingHf.ok) return;

    expect(checkTargetHealthFactorInvariant(resultingHf.value, targetHealthFactor)).toBe(true);
  });

  it('holds for calculateAdditionalCollateralRecommendation (F-063)', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const targetHealthFactor = 1.0;

    const result = calculateAdditionalCollateralRecommendation({ portfolio, targetHealthFactor });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const resultingCollateralValue =
      result.value.relevantValues.currentCollateralValue + result.value.relevantValues.requiredUsd;
    const resultingHf = calculateHealthFactor(
      resultingCollateralValue,
      protocol.liquidationThreshold,
      portfolio.debt.balance,
    );
    expect(resultingHf.ok).toBe(true);
    if (!resultingHf.ok) return;

    expect(checkTargetHealthFactorInvariant(resultingHf.value, targetHealthFactor)).toBe(true);
  });

  it('documents a known exception: calculateTargetExit (healthFactor target, M2-024) does NOT reproduce the target exactly', () => {
    // This invariant does not hold for calculateTargetExit's 'healthFactor'
    // branch, and that is a documented finding, not a bug fixed here — see
    // PROJECT_STATUS.md. F-040 "Target Debt" computes its target assuming
    // collateral stays fixed, matching the EXIT DEPENDENCY GRAPH's
    // sequential F-040 -> F-041 -> F-042 chain (02_Formulas.md), but an
    // actual exit sells BTC to fund the repayment, which reduces
    // collateral value too. F-040 never accounts for that self-referential
    // effect (unlike F-045 "Target Price Exit", which explicitly says its
    // own target is solved "iteratively" — F-040 has no such note). The
    // Engine implements F-040 exactly as documented rather than inventing
    // a corrective, undocumented equation; the result is that the actual
    // post-exit Health Factor falls short of the requested target whenever
    // a nontrivial sale occurs.
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };
    const targetHealthFactor = 2.0;

    const result = calculateTargetExit({
      portfolio,
      target: { type: 'healthFactor', targetHealthFactor },
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.exit) return;

    const resultingHf = calculateHealthFactor(
      result.value.exit.remainingCollateralValue,
      protocol.liquidationThreshold,
      result.value.exit.remainingDebt,
    );
    expect(resultingHf.ok).toBe(true);
    if (!resultingHf.ok) return;

    // The invariant is violated here (by design, per the documented
    // formula chain): actual HF (1.8) undershoots the target (2.0).
    expect(checkTargetHealthFactorInvariant(resultingHf.value, targetHealthFactor)).toBe(false);
    expect(resultingHf.value).toBeCloseTo(1.8, 6);
  });
});

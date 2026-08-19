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

  it('holds for calculateTargetExit (healthFactor target, M2-024) — Conflict #13 resolved', () => {
    // Previously a documented exception: calculateTargetExit's
    // 'healthFactor' branch reused F-040 "Target Debt", which assumes
    // collateral stays fixed — wrong for an exit, which sells BTC
    // collateral to fund the very repayment being solved for. That has
    // been fixed with a self-financed closed-form solve of F-022's Health
    // Factor equation (see `resolveTargetDebt` in calculateTargetExit.ts),
    // and `calculateTargetExit` itself now verifies the resulting Health
    // Factor against the requested target — using this same invariant —
    // before reporting `feasible: true`. This invariant now holds here
    // like it does for every other Target Health Factor entry point.
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

    expect(result.value.feasible).toBe(true);

    const resultingHf = calculateHealthFactor(
      result.value.exit.remainingCollateralValue,
      protocol.liquidationThreshold,
      result.value.exit.remainingDebt,
    );
    expect(resultingHf.ok).toBe(true);
    if (!resultingHf.ok) return;

    expect(checkTargetHealthFactorInvariant(resultingHf.value, targetHealthFactor)).toBe(true);
    expect(resultingHf.value).toBeCloseTo(2.0, 6);
  });
});

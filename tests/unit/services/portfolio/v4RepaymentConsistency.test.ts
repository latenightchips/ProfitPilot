import { describe, expect, it } from 'vitest';

import type { ExitTarget } from '@/engine';
import { planExit } from '@/services/exit/plan';
import type { PortfolioAction } from '@/services/portfolio/actionPreview';
import { previewPortfolioAction } from '@/services/portfolio/actionPreview';
import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { simulatePortfolioAction } from '@/services/simulation/portfolioAction';

/**
 * Cross-service V4 partial-repayment consistency — V4 Readiness Audit
 * §12 Stage 12. All three consumers of
 * `services/portfolio/mapping.ts`'s `deriveV4DebtStateAfterDelta`
 * (`services/exit/plan.ts`, `services/simulation/portfolioAction.ts`,
 * `services/portfolio/actionPreview.ts`) must agree on the resulting
 * post-repayment total debt for the identical starting state and the
 * identical repayment amount — all three ultimately delegate to the same
 * Engine formula (`deriveAaveV4DebtAfterRepayment`), so this is a
 * regression guard against any one of the three call sites silently
 * drifting (e.g. wiring the wrong sign, or bypassing the shared helper).
 */
describe('V4 partial repayment — Exit Plan / Portfolio Action / Action Preview agree on the resulting debt (Stage 12)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 5000, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
  }

  it('a $5,000 partial repayment produces the exact same post-repayment total debt via all three services', () => {
    const exitTarget: ExitTarget = { type: 'debtBalance', targetDebt: 15000 };
    const exitResult = planExit(v4Portfolio(), exitTarget, 'live');

    const simulationResult = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: -5000 },
      'live',
    );

    const repayAction: PortfolioAction = { type: 'repay', amount: 5000 };
    const previewResult = previewPortfolioAction(v4Portfolio(), repayAction, 'live');

    expect(exitResult.ok).toBe(true);
    expect(simulationResult.ok).toBe(true);
    expect(previewResult.ok).toBe(true);
    if (!exitResult.ok || !simulationResult.ok || !previewResult.ok) return;

    // Premium-first allocation: $5,000 exactly clears the $5,000
    // premiumDebt, leaving drawnDebt untouched at $15,000.
    expect(exitResult.data.after?.debtValue).toBe(15000);
    expect(simulationResult.data.after.debtValue).toBe(15000);
    expect(previewResult.data.after.debtValue).toBe(15000);
  });

  it('a full repayment produces the exact same zero-debt post-state via all three services', () => {
    const exitTarget: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const exitResult = planExit(v4Portfolio(), exitTarget, 'live');

    const simulationResult = simulatePortfolioAction(
      v4Portfolio(),
      { collateralDelta: 0, debtDelta: -20000 },
      'live',
    );

    const repayAction: PortfolioAction = { type: 'repay', amount: 20000 };
    const previewResult = previewPortfolioAction(v4Portfolio(), repayAction, 'live');

    expect(exitResult.ok).toBe(true);
    expect(simulationResult.ok).toBe(true);
    expect(previewResult.ok).toBe(true);
    if (!exitResult.ok || !simulationResult.ok || !previewResult.ok) return;

    expect(exitResult.data.after?.debtValue).toBe(0);
    expect(simulationResult.data.after.debtValue).toBe(0);
    expect(previewResult.data.after.debtValue).toBe(0);
  });
});

/**
 * Same cross-service agreement, at a non-$1 live debt price — found
 * during the final pre-commit review of V4 Readiness Audit §12 P1-D3, not
 * part of the original four fixes. All three call sites compute
 * `debtDelta`/`repayment` in USD (matching V3's own shared semantics);
 * `deriveV4DebtStateAfterDelta` must convert that USD amount to a
 * token-quantity repayment before delegating to
 * `deriveAaveV4DebtAfterRepayment`, which operates on raw
 * `drawnDebt`/`premiumDebt`. The block above (no `debtAssetPriceUsd` set)
 * cannot catch a broken conversion, since USD and token quantity are
 * numerically identical at $1.00.
 */
describe('V4 partial repayment — cross-service agreement at a non-$1 live debt price (final review)', () => {
  // 20,000 tokens (15,000 drawn + 5,000 premium) x $0.9973 = $19,946.00
  // exactly — chosen so the starting USD figure has no rounding noise.
  function pricedV4Portfolio(): ApplicationPortfolio {
    return {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 20000 },
      market: { btcPriceUsd: 50000 },
      protocol: {
        maxLoanToValue: 0.75,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
      protocolVersion: 'v4',
      v4DebtState: {
        drawnDebt: 15000,
        premiumDebt: 5000,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
        debtAssetPriceUsd: 0.9973,
      },
      v4DebtStateSource: 'live',
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
  }

  it('a $5,000 USD partial repayment lands all three services at the identical $14,946.00 result, not the raw-quantity-mismatched figure', () => {
    const exitTarget: ExitTarget = { type: 'debtBalance', targetDebt: 19946 - 5000 };
    const exitResult = planExit(pricedV4Portfolio(), exitTarget, 'live');

    const simulationResult = simulatePortfolioAction(
      pricedV4Portfolio(),
      { collateralDelta: 0, debtDelta: -5000 },
      'live',
    );

    const repayAction: PortfolioAction = { type: 'repay', amount: 5000 };
    const previewResult = previewPortfolioAction(pricedV4Portfolio(), repayAction, 'live');

    expect(exitResult.ok).toBe(true);
    expect(simulationResult.ok).toBe(true);
    expect(previewResult.ok).toBe(true);
    if (!exitResult.ok || !simulationResult.ok || !previewResult.ok) return;

    expect(exitResult.data.after?.debtValue).toBeCloseTo(14946, 1);
    expect(simulationResult.data.after.debtValue).toBeCloseTo(14946, 1);
    expect(previewResult.data.after.debtValue).toBeCloseTo(14946, 1);

    // All three agree with each other exactly, not just approximately
    // with the expected figure.
    expect(exitResult.data.after?.debtValue).toBeCloseTo(simulationResult.data.after.debtValue, 6);
    expect(simulationResult.data.after.debtValue).toBeCloseTo(
      previewResult.data.after.debtValue,
      6,
    );
  });

  it('a full repayment produces the identical zero-debt post-state via all three services at a non-$1 price', () => {
    const exitTarget: ExitTarget = { type: 'debtBalance', targetDebt: 0 };
    const exitResult = planExit(pricedV4Portfolio(), exitTarget, 'live');

    const simulationResult = simulatePortfolioAction(
      pricedV4Portfolio(),
      { collateralDelta: 0, debtDelta: -19946 },
      'live',
    );

    const repayAction: PortfolioAction = { type: 'repay', amount: 19946 };
    const previewResult = previewPortfolioAction(pricedV4Portfolio(), repayAction, 'live');

    expect(exitResult.ok).toBe(true);
    expect(simulationResult.ok).toBe(true);
    expect(previewResult.ok).toBe(true);
    if (!exitResult.ok || !simulationResult.ok || !previewResult.ok) return;

    expect(exitResult.data.after?.debtValue).toBeCloseTo(0, 6);
    expect(simulationResult.data.after.debtValue).toBeCloseTo(0, 6);
    expect(previewResult.data.after.debtValue).toBeCloseTo(0, 6);
  });
});

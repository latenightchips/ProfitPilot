import { describe, expect, it } from 'vitest';

import * as Engine from '@/engine';

/**
 * Public API surface — 06_TASKS.md M2-031 ("Publish Formula Engine API").
 *
 * Verifies both halves of the Requirements list mechanically, not just by
 * inspection: "Expose only supported public functions" (every expected
 * calculation is reachable through `@/engine` alone) and "Hide internal
 * helpers" (the invariant-check and low-level validation functions are
 * NOT reachable through the barrel, even though they remain fully
 * implemented and directly importable from their own module — see
 * engine/index.ts's own header comment and PROJECT_STATUS.md conflict
 * #17 for why each was excluded).
 */
describe('Public Engine API surface (M2-031)', () => {
  const expectedPublicFunctionNames = [
    // Exit Strategy
    'calculateBtcSaleRequired',
    'calculateExitPosition',
    'calculateRequiredDebtRepayment',
    'calculateTargetDebt',
    'calculateTargetExit',
    // Health
    'calculateAdditionalBorrow',
    'calculateHealthFactor',
    // Interest
    'calculateAnnualInterest',
    'calculateDailyInterest',
    'calculateMonthlyInterest',
    'calculateProratedInterest',
    // Liquidation
    'calculateLiquidationBuffer',
    'calculateLiquidationDistance',
    'calculateLiquidationPrice',
    // Loop
    'calculateAvailableBorrow',
    'calculateBorrowCapacity',
    'calculateBreakEvenAppreciation',
    'calculateBtcPurchasedPerLoop',
    'calculateLoopCapital',
    'calculateLoopCosts',
    'calculateLoopStep',
    'calculateLoopStrategy',
    'calculateMaximumBorrowLimit',
    'validateLoopStrategySafety',
    // Aave V3 protocol-specific accrual (not a Formula ID)
    'projectVariableDebt',
    // Portfolio
    'calculateCollateralValue',
    'calculateDebtRatio',
    'calculateDebtValue',
    'calculateEffectiveLeverage',
    'calculateExposure',
    'calculateLoanToValue',
    'calculateNetWorth',
    'calculatePortfolioValue',
    // Recommendation
    'calculateAdditionalCollateralRecommendation',
    'calculateBorrowRecommendation',
    'calculateLoopRecommendation',
    'calculateRepaymentRecommendation',
    'generateRecommendations',
    // Shared: decimal + result
    'Decimal',
    'roundForDisplay',
    'toDecimal',
    'toOutputNumber',
    'createFailure',
    'createSuccess',
    // Simulation
    'calculateDebtGrowth',
    'calculatePortfolioGain',
    'compareScenarios',
    'rankScenarios',
    'resolveScenarioPrice',
    'simulateInterestScenario',
    'simulatePositionChange',
    'simulatePriceScenario',
  ] as const;

  it.each(expectedPublicFunctionNames)('%s is reachable through @/engine alone', (name) => {
    expect(typeof (Engine as Record<string, unknown>)[name]).toBe('function');
  });

  it('DISPLAY_PRECISION is reachable through @/engine alone', () => {
    expect(Engine.DISPLAY_PRECISION).toBeDefined();
    expect(typeof Engine.DISPLAY_PRECISION).toBe('object');
  });

  const hiddenInternalNames = [
    // engine/validation/invariants.ts — test-time consistency checks, not a Service-facing calculation.
    'checkAllocationInvariant',
    'checkFullRepaymentInvariant',
    'checkLoopReconciliationInvariant',
    'checkNetWorthInvariant',
    'checkTargetHealthFactorInvariant',
    // engine/validation/validate.ts — internal plumbing every formula already uses on itself.
    'validateFinite',
    'validateNonNegative',
    'validatePercentage',
    'validatePositive',
    'validatePrice',
    'validateProtocolParameters',
    'validateRate',
    'validateThreshold',
    'validateTimePeriod',
    'validateTokenQuantity',
  ] as const;

  it.each(hiddenInternalNames)(
    '%s is NOT exposed through @/engine (hidden internal helper)',
    (name) => {
      expect((Engine as Record<string, unknown>)[name]).toBeUndefined();
    },
  );

  it('hidden internal helpers remain fully usable via their own module path (not deleted, just uncurated)', async () => {
    const invariants = await import('@/engine/validation/invariants');
    const validate = await import('@/engine/validation/validate');
    expect(typeof invariants.checkNetWorthInvariant).toBe('function');
    expect(typeof validate.validateNonNegative).toBe('function');
  });

  it('M2-031 DoD: a representative end-to-end pipeline runs using only @/engine imports, no internal module paths', () => {
    const portfolio: Engine.PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 60000 },
      market: { btcPriceUsd: 60000 },
      protocol: {
        maxLoanToValue: 0.7,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };

    const collateralValue = Engine.calculateCollateralValue(portfolio.collateral, portfolio.market);
    expect(collateralValue.ok).toBe(true);
    if (!collateralValue.ok) return;

    const healthFactor = Engine.calculateHealthFactor(
      collateralValue.value,
      portfolio.protocol.liquidationThreshold,
      portfolio.debt.balance,
    );
    expect(healthFactor.ok).toBe(true);
    if (!healthFactor.ok) return;
    expect(healthFactor.value).toBe(1.6);
    expect(healthFactor.metadata.formulaId).toBe('F-022');

    const recommendations = Engine.generateRecommendations({
      portfolio,
      rules: {
        borrow: { userMinHealthFactor: 1.5, targetDebtRatio: 0.5 },
        repayment: { targetHealthFactor: 2.0 },
        additionalCollateral: { targetHealthFactor: 1.5 },
        loop: {
          targetHealthFactor: 1.8,
          loopBorrowPercentage: 0.9,
          maxAcceptableAnnualInterestCost: 5000,
        },
      },
    });
    expect(recommendations.ok).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';

import { calculateLoopStrategy } from '@/engine/loop/calculateLoopStrategy';
import type { PortfolioInput } from '@/engine/shared/types';
import { checkLoopReconciliationInvariant } from '@/engine/validation/invariants';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

/**
 * 06_TASKS.md M2-027 invariant: "Loop results reconcile with step
 * totals." Final collateral quantity and debt must equal the starting
 * state plus the sum of every committed step's BTC purchased / borrowed
 * amount — checked across scenarios stopping for different reasons
 * (MIN_HEALTH_FACTOR_REACHED and MAX_LOOPS_REACHED).
 */
describe('Engine invariant: Loop results reconcile with step totals (M2-027)', () => {
  it('holds when the strategy stops at the minimum Health Factor', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };

    const result = calculateLoopStrategy({
      collateral: portfolio.collateral,
      debt: portfolio.debt,
      market: portfolio.market,
      protocol: portfolio.protocol,
      targetBorrowPercentage: 0.5,
      maxLoops: 10,
      minHealthFactor: 1.5,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.stopReason).toBe('MIN_HEALTH_FACTOR_REACHED');
    expect(result.value.steps.length).toBeGreaterThan(0);

    const reconciles = checkLoopReconciliationInvariant(
      portfolio.collateral.quantity,
      result.value.finalCollateral.quantity,
      result.value.steps.map((s) => s.btcPurchased),
      portfolio.debt.balance,
      result.value.finalDebt,
      result.value.steps.map((s) => s.borrowedAmount),
    );
    expect(reconciles).toBe(true);
  });

  it('holds when the strategy stops at the configured maximum loop count', () => {
    const portfolio: PortfolioInput = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 0 },
      market: { btcPriceUsd: 60000 },
      protocol,
    };

    const result = calculateLoopStrategy({
      collateral: portfolio.collateral,
      debt: portfolio.debt,
      market: portfolio.market,
      protocol: portfolio.protocol,
      targetBorrowPercentage: 0.5,
      maxLoops: 2,
      minHealthFactor: 0.01,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.stopReason).toBe('MAX_LOOPS_REACHED');
    expect(result.value.steps).toHaveLength(2);

    const reconciles = checkLoopReconciliationInvariant(
      portfolio.collateral.quantity,
      result.value.finalCollateral.quantity,
      result.value.steps.map((s) => s.btcPurchased),
      portfolio.debt.balance,
      result.value.finalDebt,
      result.value.steps.map((s) => s.borrowedAmount),
    );
    expect(reconciles).toBe(true);
  });
});

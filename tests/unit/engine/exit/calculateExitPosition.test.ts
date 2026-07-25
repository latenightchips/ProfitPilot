import { describe, expect, it } from 'vitest';

import { calculateExitPosition, type ExitPositionInput } from '@/engine/exit/calculateExitPosition';
import type { PortfolioInput } from '@/engine/shared/types';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(overrides: Partial<ExitPositionInput> = {}): ExitPositionInput {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 48000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    targetDebt: 0,
    ...overrides,
  };
}

describe('calculateExitPosition (M2-023, F-042)', () => {
  it('computes a full-exit result (targetDebt 0) that reconciles with portfolio balances', () => {
    const result = calculateExitPosition(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-042');
    expect(result.value.repayment).toBe(48000);
    expect(result.value.btcSold).toBe(0.8);
    expect(result.value.btcRetained).toBeCloseTo(1.2, 8);
    expect(result.value.remainingDebt).toBe(0);
    expect(result.value.remainingCollateralValue).toBeCloseTo(72000, 6);
    expect(result.value.remainingEquity).toBeCloseTo(72000, 6);
  });

  it('computes a partial-exit result that reconciles with portfolio balances', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 24000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.repayment).toBe(24000);
    expect(result.value.btcSold).toBeCloseTo(0.4, 8);
    expect(result.value.btcRetained).toBeCloseTo(1.6, 8);
    expect(result.value.remainingDebt).toBe(24000);
    expect(result.value.remainingCollateralValue).toBeCloseTo(96000, 6);
    expect(result.value.remainingEquity).toBeCloseTo(72000, 6);
  });

  it('itemizes exit transaction costs as unavailable, with a reason for each', () => {
    const result = calculateExitPosition(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const items = result.value.unavailableCosts.map((c) => c.item);
    expect(items).toEqual(['swapFees', 'slippage', 'gasEstimate']);
    for (const entry of result.value.unavailableCosts) {
      expect(entry.reason.length).toBeGreaterThan(0);
    }
  });

  it('supports an optional scenario BTC price override ("Target BTC price")', () => {
    const result = calculateExitPosition(baseInput({ scenarioBtcPriceUsd: 80000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.btcSold).toBe(0.6); // 48000 / 80000
    expect(result.value.remainingCollateralValue).toBeCloseTo((2 - 0.6) * 80000, 6);
  });

  it('rejects a targetDebt greater than current debt', () => {
    const result = calculateExitPosition(baseInput({ targetDebt: 50000 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_TARGET_DEBT');
  });

  it('rejects an exit that would require selling more BTC than is held', () => {
    const result = calculateExitPosition(baseInput({ scenarioBtcPriceUsd: 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INSUFFICIENT_COLLATERAL');
  });

  it('rejects negative targetDebt', () => {
    expect(calculateExitPosition(baseInput({ targetDebt: -1 })).ok).toBe(false);
  });

  it('propagates a failure from invalid debt input', () => {
    const result = calculateExitPosition(
      baseInput({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 2 },
          debt: { asset: 'USDC', balance: -1 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});

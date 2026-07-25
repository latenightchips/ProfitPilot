import { describe, expect, it } from 'vitest';

import type { PortfolioInput } from '@/engine/shared/types';
import {
  type PositionChangeInput,
  simulatePositionChange,
} from '@/engine/simulation/simulatePositionChange';

const protocol = {
  maxLoanToValue: 0.7,
  liquidationThreshold: 0.8,
  borrowApr: 0.05,
  supplyApr: 0.02,
};

function baseInput(overrides: Partial<PositionChangeInput> = {}): PositionChangeInput {
  const portfolio: PortfolioInput = {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 30000 },
    market: { btcPriceUsd: 60000 },
    protocol,
  };
  return {
    portfolio,
    collateralDelta: 0,
    debtDelta: 0,
    ...overrides,
  };
}

describe('simulatePositionChange (M2-021, F-052)', () => {
  it('returns unchanged before/after snapshots when no delta is applied', () => {
    const result = simulatePositionChange(baseInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.metadata.formulaId).toBe('F-052');
    expect(result.value.before).toEqual(result.value.after);
    expect(result.value.before.collateralValue).toBe(60000);
    expect(result.value.before.netEquity).toBe(30000);
    expect(result.value.before.loanToValue).toBe(0.5);
    expect(result.value.before.healthFactor).toBeCloseTo(1.6, 6);
  });

  it('combines adding collateral and borrowing more in one call ("Combined actions")', () => {
    const result = simulatePositionChange(baseInput({ collateralDelta: 0.5, debtDelta: 10000 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.before.collateralValue).toBe(60000);
    expect(result.value.after.collateralValue).toBe(90000);
    expect(result.value.after.netEquity).toBe(50000);
    expect(result.value.after.loanToValue).toBeCloseTo(0.444444, 6);
    expect(result.value.after.healthFactor).toBeCloseTo(1.8, 6);
  });

  it('supports "Withdraw collateral" as a negative delta', () => {
    const result = simulatePositionChange(baseInput({ collateralDelta: -0.4 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.after.collateralValue).toBe(36000);
  });

  it('supports "Repay debt" as a negative debt delta', () => {
    const result = simulatePositionChange(baseInput({ debtDelta: -10000 }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.after.debtValue).toBe(20000);
  });

  it('rejects withdrawing more collateral than is held', () => {
    const result = simulatePositionChange(baseInput({ collateralDelta: -2 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_COLLATERAL_DELTA');
  });

  it('rejects repaying more debt than is owed', () => {
    const result = simulatePositionChange(baseInput({ debtDelta: -40000 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('INVALID_DEBT_DELTA');
  });

  it('propagates a failure from invalid collateral input', () => {
    const result = simulatePositionChange(
      baseInput({
        portfolio: {
          collateral: { asset: 'BTC', quantity: -1 },
          debt: { asset: 'USDC', balance: 30000 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from invalid (negative) debt input', () => {
    const result = simulatePositionChange(
      baseInput({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 1 },
          debt: { asset: 'USDC', balance: -1 },
          market: { btcPriceUsd: 60000 },
          protocol,
        },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('propagates a failure from an invalid protocol liquidation threshold', () => {
    const result = simulatePositionChange(
      baseInput({
        portfolio: {
          collateral: { asset: 'BTC', quantity: 1 },
          debt: { asset: 'USDC', balance: 30000 },
          market: { btcPriceUsd: 60000 },
          protocol: { ...protocol, liquidationThreshold: 1.5 },
        },
      }),
    );
    expect(result.ok).toBe(false);
  });
});

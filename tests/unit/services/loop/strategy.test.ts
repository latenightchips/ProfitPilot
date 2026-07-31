import { describe, expect, it } from 'vitest';

import type { LoopStrategySettings } from '@/services/loop/strategy';
import { planLoopStrategy } from '@/services/loop/strategy';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

/**
 * Loop Strategy Service — 06_TASKS.md M3-010.
 *
 * Revisits conflict #8 (no documented swap-fee/slippage/gas-estimate
 * formula): `calculateLoopCosts` already itemizes those as `unavailable`
 * with reasons rather than fabricating a cost model — these tests verify
 * that itemization is passed through unchanged, not re-verify Milestone
 * 2's own step-by-step loop math (already covered by
 * `tests/unit/engine/loop/`).
 */
function healthyPortfolio(): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 1 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.5,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
  };
}

function healthySettings(): LoopStrategySettings {
  return { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 };
}

describe('planLoopStrategy (M3-010)', () => {
  it('returns a viable strategy with at least one step and computed costs', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(true);
    expect(result.data.strategy).not.toBeNull();
    expect(result.data.strategy?.steps.length).toBeGreaterThan(0);
    expect(result.data.costs).not.toBeNull();
  });

  it('returns a real, positive btcExposure for a viable strategy (M7-011)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.btcExposure).not.toBeNull();
    expect(result.data.btcExposure).toBeGreaterThan(0);
  });

  it('returns a null btcExposure alongside a null strategy for a non-viable result', () => {
    const atLiquidation: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 9000 },
      market: { btcPriceUsd: 10000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(atLiquidation, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.btcExposure).toBeNull();
  });

  it('itemizes swap fees, slippage, gas estimate, and total cost as unavailable (conflict #8)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const items = result.data.costs?.unavailable.map((u) => u.item);
    expect(items).toEqual(
      expect.arrayContaining(['swapFees', 'slippage', 'gasEstimate', 'totalImplementationCost']),
    );
    expect(result.data.costs?.unavailable).toHaveLength(4);
  });

  it('computes borrowing interest and break-even appreciation (the documented, computable cost fields)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(typeof result.data.costs?.borrowingInterest).toBe('number');
    expect(typeof result.data.costs?.breakEvenAppreciation).toBe('number');
  });

  it('reports non-viable with an error finding when the starting position is already at liquidation', () => {
    const atLiquidation: ApplicationPortfolio = {
      collateral: { asset: 'BTC', quantity: 1 },
      debt: { asset: 'USDC', balance: 9000 },
      market: { btcPriceUsd: 10000 },
      protocol: {
        maxLoanToValue: 0.5,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(atLiquidation, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.strategy).toBeNull();
    expect(result.data.costs).toBeNull();
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'LIQUIDATION_PROXIMITY', severity: 'error' }),
    );
  });

  it('reports non-viable when the configured minHealthFactor is at or below the liquidation boundary', () => {
    const invalidSettings: LoopStrategySettings = { ...healthySettings(), minHealthFactor: 1 };
    const result = planLoopStrategy(healthyPortfolio(), invalidSettings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'MINIMUM_HEALTH_FACTOR', severity: 'error' }),
    );
  });

  it('threads sourceStatus through to metadata', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'manual');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metadata.sourceStatus).toBe('manual');
  });

  it('reports non-viable (not an Engine failure) for invalid protocol parameters — validateLoopStrategySafety carries this as data', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      protocol: {
        maxLoanToValue: 0.9,
        liquidationThreshold: 0.8,
        borrowApr: 0.05,
        supplyApr: 0.02,
      },
    };
    const result = planLoopStrategy(invalidPortfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'VALID_PROTOCOL_PARAMETERS', severity: 'error' }),
    );
  });

  it('propagates a genuine Engine failure for malformed input (negative collateral quantity)', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const result = planLoopStrategy(invalidPortfolio, healthySettings(), 'live');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'INVALID_NON_NEGATIVE' });
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const invalidPortfolio: ApplicationPortfolio = {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: -1 },
    };
    const result = planLoopStrategy(invalidPortfolio, healthySettings(), 'live');
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    expect('errors' in result).toBe(false);
  });
});

/**
 * `maxLoanToValueOverride`/`borrowAprOverride` — Milestone 7 Batch 2
 * (M7-008, "Implement Loop Strategy Controls"). Zero Engine changes;
 * these tests confirm the Service-layer substitution actually reaches
 * both the safety validation and the cost calculation, not just one.
 */
describe('planLoopStrategy — protocol overrides (M7-008)', () => {
  it('uses the real portfolio borrowApr for costs when no override is supplied', () => {
    const result = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    const expectedInterest = result.data.strategy.finalDebt * 0.05;
    expect(result.data.costs?.borrowingInterest).toBeCloseTo(expectedInterest, 5);
  });

  it('uses borrowAprOverride for cost calculation instead of the real portfolio rate', () => {
    const settings: LoopStrategySettings = { ...healthySettings(), borrowAprOverride: 0.2 };
    const result = planLoopStrategy(healthyPortfolio(), settings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;
    const expectedInterest = result.data.strategy.finalDebt * 0.2;
    expect(result.data.costs?.borrowingInterest).toBeCloseTo(expectedInterest, 5);
  });

  it('rejects an invalid maxLoanToValueOverride the same way an invalid real protocol value is rejected', () => {
    const settings: LoopStrategySettings = { ...healthySettings(), maxLoanToValueOverride: 1.5 };
    const result = planLoopStrategy(healthyPortfolio(), settings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.viable).toBe(false);
    expect(result.data.findings).toContainEqual(
      expect.objectContaining({ check: 'VALID_PROTOCOL_PARAMETERS', severity: 'error' }),
    );
  });

  it('a stricter maxLoanToValueOverride changes the computed strategy outcome versus the real, looser protocol value', () => {
    const unrestricted = planLoopStrategy(healthyPortfolio(), healthySettings(), 'live');
    const restricted = planLoopStrategy(
      healthyPortfolio(),
      { ...healthySettings(), maxLoanToValueOverride: 0.1 },
      'live',
    );
    expect(unrestricted.ok).toBe(true);
    expect(restricted.ok).toBe(true);
    if (!unrestricted.ok || !restricted.ok) return;
    // A much tighter LTV ceiling than the portfolio's own real 0.5 must
    // change the resulting stop reason or final debt — proves the
    // override reaches the actual calculation, not just validation.
    expect(restricted.data.strategy?.finalDebt).not.toEqual(unrestricted.data.strategy?.finalDebt);
  });
});

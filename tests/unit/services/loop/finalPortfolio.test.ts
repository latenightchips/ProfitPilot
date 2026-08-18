import { describe, expect, it } from 'vitest';

import { buildFinalLoopPortfolio } from '@/services/loop/finalPortfolio';
import type { LoopStrategySettings } from '@/services/loop/strategy';
import { planLoopStrategy } from '@/services/loop/strategy';
import type { ApplicationPortfolio } from '@/services/portfolio/models';

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

describe('buildFinalLoopPortfolio (Milestone 7 Batch 3)', () => {
  it('carries the strategy final collateral/debt and the starting market/protocol unchanged', () => {
    const portfolio = healthyPortfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.collateral).toEqual(result.data.strategy.finalCollateral);
    expect(finalPortfolio.debt).toEqual({
      asset: portfolio.debt.asset,
      balance: result.data.strategy.finalDebt,
    });
    expect(finalPortfolio.market).toBe(portfolio.market);
    expect(finalPortfolio.protocol).toBe(portfolio.protocol);
  });

  it('a V3 (or unset) portfolio never carries a protocolVersion/v4DebtState on the final portfolio', () => {
    const portfolio = healthyPortfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.protocolVersion).toBeUndefined();
    expect(finalPortfolio.v4DebtState).toBeUndefined();
  });
});

/**
 * V4 identity carry-through — V4 Readiness Audit §12 Stage 17 (Part 3), a
 * real defect found while implementing that stage (see this file's own
 * header comment on `buildFinalLoopPortfolio`). Before this fix, the
 * final portfolio built here was always V3-shaped — verified empirically
 * that `services/simulation/scenario.ts`'s V4 branch was completely
 * unreachable through `stores/loopBuilderStore.ts`'s `runSensitivityScenario`
 * as a direct result, regardless of what `LoopScenarioSensitivity.tsx`
 * set `scenario.v4RateStress` to.
 */
describe('buildFinalLoopPortfolio — V4 identity carry-through (Stage 17)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.1 },
      // Stage 23E's collateral-risk guard now requires this on every V4
      // portfolio, in addition to v4DebtState.
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
  }

  it('carries protocolVersion/v4Position onto the final portfolio', () => {
    const portfolio = v4Portfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.protocolVersion).toBe('v4');
    expect(finalPortfolio.v4Position).toEqual(portfolio.v4Position);
  });

  it('attributes the entire newly-borrowed amount to drawnDebt, leaving premiumDebt/rates unchanged, and the two streams sum to finalDebt exactly', () => {
    const portfolio = v4Portfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    const finalV4State = finalPortfolio.v4DebtState;
    expect(finalV4State).toBeDefined();
    if (finalV4State === undefined) return;

    const newlyBorrowed = result.data.strategy.finalDebt - (20000 + 500);
    expect(newlyBorrowed).toBeGreaterThan(0);
    expect(finalV4State.drawnDebt).toBeCloseTo(20000 + newlyBorrowed, 6);
    expect(finalV4State.premiumDebt).toBe(500);
    expect(finalV4State.baseDrawnApr).toBe(0.05);
    expect(finalV4State.riskPremium).toBe(0.1);
    expect(finalV4State.drawnDebt + finalV4State.premiumDebt).toBeCloseTo(
      result.data.strategy.finalDebt,
      6,
    );
  });

  it('never carries a v4DebtState for a V4 portfolio whose own v4DebtState was somehow absent (defensive; unreachable via a real strategy result)', () => {
    const portfolio: ApplicationPortfolio = { ...v4Portfolio(), v4DebtState: undefined };
    const finalPortfolio = buildFinalLoopPortfolio(portfolio, {
      steps: [],
      finalCollateral: portfolio.collateral,
      finalDebt: 0,
      finalEquity: 0,
      finalLeverage: 0,
      finalHealthFactor: 0,
      stopReason: 'MAX_LOOPS_REACHED',
    });
    expect(finalPortfolio.protocolVersion).toBeUndefined();
    expect(finalPortfolio.v4DebtState).toBeUndefined();
  });
});

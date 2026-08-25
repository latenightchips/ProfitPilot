import { describe, expect, it } from 'vitest';

import {
  buildFinalLoopPortfolio,
  loopIntroducesAmbiguousV4Borrow,
} from '@/services/loop/finalPortfolio';
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

/**
 * BLOCKER #3 fix — a real new V4 borrow's post-borrow `riskPremium` is
 * not knowable (see this file's own `buildFinalLoopPortfolio`/
 * `loopIntroducesAmbiguousV4Borrow` header comments for the full
 * protocol-audited reasoning), so it must never be silently carried
 * forward and presented as exact. `riskPremium: 0.13` below is a
 * deliberately distinctive value (not `0.1`/`0.05`, values used
 * elsewhere in this file) — if it ever leaked into a real assertion
 * below, it would be numerically obvious rather than coincidentally
 * matching another fixture's value.
 */
describe('buildFinalLoopPortfolio — ambiguous V4 borrow fails closed on riskPremium (BLOCKER #3 fix)', () => {
  function v4Portfolio(): ApplicationPortfolio {
    return {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: { drawnDebt: 20000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.13 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
  }

  it('loopIntroducesAmbiguousV4Borrow is true when the strategy actually borrows more', () => {
    const portfolio = v4Portfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    expect(result.data.strategy.finalDebt).toBeGreaterThan(20000 + 500);
    expect(loopIntroducesAmbiguousV4Borrow(portfolio, result.data.strategy)).toBe(true);
  });

  it('omits v4DebtState entirely for a real new borrow — never carries the pre-borrow riskPremium (0.13) forward as exact', () => {
    const portfolio = v4Portfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.v4DebtState).toBeUndefined();
    // protocolVersion/v4Position/v4CollateralRisk are unaffected by this
    // fix — only the ambiguous debt state is withheld.
    expect(finalPortfolio.protocolVersion).toBe('v4');
    expect(finalPortfolio.v4Position).toEqual(portfolio.v4Position);
    expect(finalPortfolio.v4CollateralRisk).toEqual(portfolio.v4CollateralRisk);
  });

  it('a zero-loop strategy (no real borrow occurred) is unaffected — riskPremium (0.13) is correctly carried forward, not an assumption', () => {
    const portfolio = v4Portfolio();
    const zeroLoopSettings: LoopStrategySettings = {
      targetBorrowPercentage: 0.5,
      maxLoops: 0,
      minHealthFactor: 1.1,
    };
    const result = planLoopStrategy(portfolio, zeroLoopSettings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    expect(result.data.strategy.finalDebt).toBeCloseTo(20000 + 500, 6);
    expect(loopIntroducesAmbiguousV4Borrow(portfolio, result.data.strategy)).toBe(false);

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.v4DebtState).toBeDefined();
    expect(finalPortfolio.v4DebtState?.riskPremium).toBe(0.13);
    expect(finalPortfolio.v4DebtState?.drawnDebt).toBe(20000);
    expect(finalPortfolio.v4DebtState?.premiumDebt).toBe(500);
  });

  it('loopIntroducesAmbiguousV4Borrow is false for a V3 (or unset) portfolio regardless of how much the strategy borrows', () => {
    const portfolio = healthyPortfolio();
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    expect(loopIntroducesAmbiguousV4Borrow(portfolio, result.data.strategy)).toBe(false);
    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.protocolVersion).toBeUndefined();
  });
});

/**
 * USD-vs-raw-quantity comparison — V4 Readiness Audit §12 P1-D3, a genuine
 * defect found during that stage's own review (see this file's
 * `loopIntroducesAmbiguousV4Borrow`/`buildFinalLoopPortfolio` header
 * comments). `strategy.finalDebt` is USD; before this fix it was compared
 * against/subtracted from the raw `drawnDebt + premiumDebt` sum directly
 * — only safe under the old implicit-$1 assumption. A live V4 portfolio
 * with a real (non-$1) `debtAssetPriceUsd` exposes the mismatch: a
 * zero-loop (no real borrow) result would previously compute a spurious
 * nonzero "newly borrowed" quantity purely from the price gap and corrupt
 * `drawnDebt`, even though nothing was actually borrowed.
 */
describe('buildFinalLoopPortfolio — USD-consistent comparison with a non-$1 debt price (P1-D3)', () => {
  function pricedV4Portfolio(debtAssetPriceUsd: number): ApplicationPortfolio {
    return {
      ...healthyPortfolio(),
      collateral: { asset: 'BTC', quantity: 2 },
      debt: { asset: 'USDC', balance: 999999 },
      protocolVersion: 'v4',
      v4Position: { userAddress: '0x1234567890123456789012345678901234567890' },
      v4DebtState: {
        drawnDebt: 20000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.13,
        debtAssetPriceUsd,
      },
      v4DebtStateSource: 'live',
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
    };
  }

  it('a zero-loop result at a non-$1 price is never flagged ambiguous, and carries v4DebtState — including the price — through byte-identical', () => {
    const portfolio = pricedV4Portfolio(0.9973);
    const zeroLoopSettings: LoopStrategySettings = {
      targetBorrowPercentage: 0.5,
      maxLoops: 0,
      minHealthFactor: 1.1,
    };
    const result = planLoopStrategy(portfolio, zeroLoopSettings, 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    // strategy.finalDebt is the USD-priced starting balance (20,500 x
    // 0.9973), never the raw 20,500 quantity.
    expect(result.data.strategy.finalDebt).toBeCloseTo(20500 * 0.9973, 6);
    expect(result.data.strategy.finalDebt).not.toBeCloseTo(20500, 6);

    expect(loopIntroducesAmbiguousV4Borrow(portfolio, result.data.strategy)).toBe(false);

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.v4DebtState).toEqual(portfolio.v4DebtState);
    expect(finalPortfolio.v4DebtState?.drawnDebt).toBe(20000);
    expect(finalPortfolio.v4DebtState?.debtAssetPriceUsd).toBe(0.9973);
  });

  it('a real new borrow is still correctly flagged ambiguous at a non-$1 price (the fix does not weaken genuine-borrow detection)', () => {
    const portfolio = pricedV4Portfolio(0.9973);
    const result = planLoopStrategy(portfolio, healthySettings(), 'live');
    expect(result.ok).toBe(true);
    if (!result.ok || result.data.strategy === null) return;

    expect(result.data.strategy.finalDebt).toBeGreaterThan(20500 * 0.9973);
    expect(loopIntroducesAmbiguousV4Borrow(portfolio, result.data.strategy)).toBe(true);

    const finalPortfolio = buildFinalLoopPortfolio(portfolio, result.data.strategy);
    expect(finalPortfolio.v4DebtState).toBeUndefined();
  });
});

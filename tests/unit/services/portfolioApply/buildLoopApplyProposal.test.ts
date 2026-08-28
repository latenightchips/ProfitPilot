import { describe, expect, it } from 'vitest';

import { planLoopStrategy } from '@/services/loop/strategy';
import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { buildLoopApplyProposal } from '@/services/portfolioApply/buildLoopApplyProposal';

/**
 * `buildLoopApplyProposal` — V1.1 Batch 3. Uses the real
 * `planLoopStrategy` (never a hand-built mock strategy), so these tests
 * exercise the exact same `LoopStrategyResult` the Loop Builder UI itself
 * computes and displays.
 */
function basePortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
  return {
    collateral: { asset: 'BTC', quantity: 2 },
    debt: { asset: 'USDC', balance: 0 },
    market: { btcPriceUsd: 50000 },
    protocol: {
      maxLoanToValue: 0.7,
      liquidationThreshold: 0.8,
      borrowApr: 0.05,
      supplyApr: 0.02,
    },
    ...overrides,
  };
}

function viableStrategyFor(portfolio: ApplicationPortfolio) {
  const preview = planLoopStrategy(
    portfolio,
    { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 },
    'manual',
  );
  if (!preview.ok || preview.data.strategy === null) {
    throw new Error('setup failed: expected a viable strategy');
  }
  return preview.data.strategy;
}

describe('buildLoopApplyProposal — V3', () => {
  it('builds a proposal from the real buildFinalLoopPortfolio output', () => {
    const portfolio = basePortfolio();
    const strategy = viableStrategyFor(portfolio);

    const result = buildLoopApplyProposal(
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      strategy,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.data.sourceWorkflow).toBe('loopBuilder');
    expect(result.data.portfolioId).toBe('portfolio-1');
    expect(result.data.sourcePortfolioUpdatedAt).toBe('2026-01-01T00:00:00.000Z');
    expect(result.data.protocolVersion).toBe('v3');
    expect(result.data.proposedPortfolio.collateral.quantity).toBe(
      strategy.finalCollateral.quantity,
    );
    expect(result.data.proposedPortfolio.debt.balance).toBe(strategy.finalDebt);
    expect(result.data.valueBasis).toBe('hypothetical');
    expect(result.data.before.healthFactor).not.toBe(result.data.after.healthFactor);
  });

  it('states market price and protocol rates as unchanged assumptions', () => {
    const portfolio = basePortfolio();
    const strategy = viableStrategyFor(portfolio);
    const result = buildLoopApplyProposal(
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      strategy,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.unchangedAssumptions).toContain('Market price');
  });
});

describe('buildLoopApplyProposal — V4', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      debt: { asset: 'USDC', balance: 999999 },
      ...overrides,
    });
  }

  it('tags protocolVersion "v4" and carries the real post-loop v4DebtState', () => {
    const portfolio = v4Portfolio();
    // maxLoops: 0 keeps this non-ambiguous (no real new borrow) so a
    // proposal can actually be built — see the "ambiguous borrow" test
    // below for the case that must fail.
    const preview = planLoopStrategy(
      portfolio,
      { targetBorrowPercentage: 0.3, maxLoops: 0, minHealthFactor: 1.2 },
      'manual',
    );
    if (!preview.ok || preview.data.strategy === null) throw new Error('setup failed');

    const result = buildLoopApplyProposal(
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      preview.data.strategy,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.protocolVersion).toBe('v4');
    expect(result.data.proposedPortfolio.v4DebtState).toEqual(portfolio.v4DebtState);
  });

  it('fails to build a proposal when the loop introduces a genuinely ambiguous new V4 borrow (never exposes Apply for an invalid result)', () => {
    const portfolio = v4Portfolio();
    const preview = planLoopStrategy(
      portfolio,
      { targetBorrowPercentage: 0.5, maxLoops: 3, minHealthFactor: 1.1 },
      'manual',
    );
    if (!preview.ok || preview.data.strategy === null) throw new Error('setup failed');
    expect(preview.data.strategy.finalDebt).toBeGreaterThan(15500);

    const result = buildLoopApplyProposal(
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      preview.data.strategy,
    );
    expect(result.ok).toBe(false);
  });

  it('states the V4 collateral-risk configuration as unchanged', () => {
    const portfolio = v4Portfolio();
    const preview = planLoopStrategy(
      portfolio,
      { targetBorrowPercentage: 0.3, maxLoops: 0, minHealthFactor: 1.2 },
      'manual',
    );
    if (!preview.ok || preview.data.strategy === null) throw new Error('setup failed');

    const result = buildLoopApplyProposal(
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      preview.data.strategy,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.unchangedAssumptions.join(' ')).toContain('collateral-risk');
  });
});

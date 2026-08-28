import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { buildPortfolioActionApplyProposal } from '@/services/portfolioApply/buildPortfolioActionApplyProposal';

/**
 * `buildPortfolioActionApplyProposal` — V1.1 Batch 3. Shared by
 * Simulation ("Portfolio Action" scenarios) and Exit Planner (a
 * `-btcSold`/`-repayment` delta) — see this function's own header
 * comment. Tested once here at the Service level for both labels;
 * component-level tests confirm each feature actually computes the
 * correct delta and passes the right `sourceWorkflow`.
 */
function basePortfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
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
    ...overrides,
  };
}

describe('buildPortfolioActionApplyProposal — V3', () => {
  it('builds a proposal for a Simulation-sourced delta', () => {
    const portfolio = basePortfolio();
    const result = buildPortfolioActionApplyProposal(
      'simulation',
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      { collateralDelta: 0.5, debtDelta: 5000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sourceWorkflow).toBe('simulation');
    expect(result.data.proposedPortfolio.collateral.quantity).toBe(2.5);
    expect(result.data.proposedPortfolio.debt.balance).toBe(25000);
    expect(result.data.protocolVersion).toBe('v3');
  });

  it('builds a proposal for an Exit-Planner-sourced delta (a negative collateral/debt delta) — a realistic full exit that fully repays debt while retaining leftover collateral', () => {
    const portfolio = basePortfolio();
    // A realistic full exit sells only what's needed to repay the debt
    // (0.5 BTC at $50k = $25,000, more than covers the $20,000 debt),
    // retaining the rest.
    const result = buildPortfolioActionApplyProposal(
      'exitPlanner',
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      { collateralDelta: -0.5, debtDelta: -20000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.sourceWorkflow).toBe('exitPlanner');
    expect(result.data.proposedPortfolio.collateral.quantity).toBe(1.5);
    expect(result.data.proposedPortfolio.debt.balance).toBe(0);
    // Zero-debt -> Infinity Health Factor, the real engine value (Section 6).
    expect(result.data.after.healthFactor).toBe(Infinity);
    expect(result.data.after.liquidation).toBeNull();
  });

  it('V1.1 Batch 4: builds a proposal for a full exit that lands on literally 0 collateral AND 0 debt (0/0) — previously unrepresentable, now succeeds', () => {
    // Before this batch, `calculatePortfolioSummary`'s leverage formula
    // (collateralValue / netEquity) failed with DIVISION_BY_ZERO for this
    // exact case — see this test file's git history for the old
    // documented workaround. The Batch 4 Engine fix makes this a normal,
    // successful proposal: leverage 0, Health Factor Infinity.
    const portfolio = basePortfolio();
    const result = buildPortfolioActionApplyProposal(
      'exitPlanner',
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      { collateralDelta: -2, debtDelta: -20000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.proposedPortfolio.collateral.quantity).toBe(0);
    expect(result.data.proposedPortfolio.debt.balance).toBe(0);
    expect(result.data.after.collateralValue).toBe(0);
    expect(result.data.after.debtValue).toBe(0);
    expect(result.data.after.leverage).toBe(0);
    expect(result.data.after.healthFactor).toBe(Infinity);
    expect(result.data.after.liquidation).toBeNull();
    expect(Number.isNaN(result.data.after.leverage)).toBe(false);
  });
});

describe('buildPortfolioActionApplyProposal — V4', () => {
  function v4Portfolio(overrides: Partial<ApplicationPortfolio> = {}): ApplicationPortfolio {
    return basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 15000, premiumDebt: 500, baseDrawnApr: 0.05, riskPremium: 0.01 },
      v4CollateralRisk: { collateralFactor: 0.8, dynamicConfigKey: 1 },
      ...overrides,
    });
  }

  it('derives the real premium-first repayment split for a V4 repay delta', () => {
    const portfolio = v4Portfolio();
    const result = buildPortfolioActionApplyProposal(
      'exitPlanner',
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      { collateralDelta: -1, debtDelta: -5000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.protocolVersion).toBe('v4');
    // Premium (500) repaid first, remaining 4500 off drawnDebt.
    expect(result.data.proposedPortfolio.v4DebtState).toEqual({
      drawnDebt: 10500,
      premiumDebt: 0,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
  });

  it('fails to build a proposal for a genuinely ambiguous new V4 borrow (positive debtDelta) — never exposes Apply for an invalid result', () => {
    const portfolio = v4Portfolio();
    const result = buildPortfolioActionApplyProposal(
      'simulation',
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      { collateralDelta: 0, debtDelta: 1000 },
    );
    expect(result.ok).toBe(false);
  });

  it('states the V4 collateral-risk configuration and on-chain position identity as unchanged', () => {
    const portfolio = v4Portfolio();
    const result = buildPortfolioActionApplyProposal(
      'exitPlanner',
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      portfolio,
      { collateralDelta: -1, debtDelta: -5000 },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.unchangedAssumptions.join(' ')).toContain('collateral-risk');
  });
});

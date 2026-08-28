import { describe, expect, it } from 'vitest';

import type { ApplicationPortfolio } from '@/services/portfolio/models';
import { explainTargetHealthFactorActions } from '@/services/recommendation/explainRecommendation';
import { calculateTargetHealthFactorActions } from '@/services/recommendation/targetHealthFactorActions';

/**
 * `explainTargetHealthFactorActions` — V1.1 Batch 5 ("Recommendation
 * Quality & Explainability"), Section 2/3/4/5/7. Same base portfolio as
 * `targetHealthFactorActions.test.ts` (2 BTC @ $50,000, $20,000 debt,
 * Health Factor 4) so both files agree on what "actionable" vs. "no
 * action needed" actually means for this fixture.
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

describe('explainTargetHealthFactorActions', () => {
  it('builds a real, quantified before/after impact for an actionable repayment recommendation, reusing buildPortfolioActionApplyProposal', () => {
    // HF = 4; target 5 requires actual repayment.
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    const { repayment } = explanations;
    expect(repayment.isActionable).toBe(true);
    expect(repayment.impact).not.toBeNull();
    if (repayment.impact === null) return;
    expect(repayment.impact.healthFactor.before).toBe(4);
    expect(repayment.impact.healthFactor.after).toBeCloseTo(5, 6);
    expect(repayment.impact.debtValue.before).toBe(20000);
    expect(repayment.impact.debtValue.after).toBeLessThan(20000);
    expect(repayment.applyProposal).not.toBeNull();
    expect(repayment.applyProposal?.sourceWorkflow).toBe('exitPlanner');
  });

  it('builds a real, quantified before/after impact for an actionable additional-collateral recommendation', () => {
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    const { additionalCollateral } = explanations;
    expect(additionalCollateral.isActionable).toBe(true);
    expect(additionalCollateral.impact).not.toBeNull();
    if (additionalCollateral.impact === null) return;
    expect(additionalCollateral.impact.collateralValue.before).toBe(100000);
    expect(additionalCollateral.impact.collateralValue.after).toBeGreaterThan(100000);
    expect(additionalCollateral.applyProposal).not.toBeNull();
    expect(additionalCollateral.applyProposal?.sourceWorkflow).toBe('simulation');
  });

  it('reports impact: null and applyProposal: null when no action is needed, never a fabricated zero-change row', () => {
    // Target 1 is already met at HF 4 — both recommendations report
    // "no action needed."
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 1, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    expect(explanations.repayment.impact).toBeNull();
    expect(explanations.repayment.isActionable).toBe(false);
    expect(explanations.repayment.applyProposal).toBeNull();
    expect(explanations.additionalCollateral.impact).toBeNull();
    expect(explanations.additionalCollateral.isActionable).toBe(false);
    expect(explanations.additionalCollateral.applyProposal).toBeNull();
  });

  it('carries the caller-supplied confidence through unchanged, for both recommendations', () => {
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'Limited data',
    );

    expect(explanations.repayment.confidence).toBe('Limited data');
    expect(explanations.additionalCollateral.confidence).toBe('Limited data');
  });

  it('title/rationale reuse the underlying Recommendation fields verbatim, never a re-derivation', () => {
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    expect(explanations.repayment.title).toBe(actionsResult.data.repayment.suggestedAction);
    expect(explanations.repayment.rationale).toBe(actionsResult.data.repayment.triggeringCondition);
  });

  it('states a real risk/tradeoff for each category, factual and non-promissory (no "guaranteed"/"safe"/"risk-free" language)', () => {
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    for (const explanation of [explanations.repayment, explanations.additionalCollateral]) {
      expect(explanation.risk.length).toBeGreaterThan(0);
      expect(explanation.risk.toLowerCase()).not.toMatch(
        /guarantee|guaranteed|risk-free|risk free|\bsafe\b|no risk/,
      );
      expect(explanation.costBenefit.toLowerCase()).not.toMatch(
        /guarantee|guaranteed|risk-free|risk free|\bsafe\b|no risk/,
      );
    }
  });

  it('states cost impact honestly as "not modeled" rather than fabricating a number (Conflict #8)', () => {
    const actionsResult = calculateTargetHealthFactorActions(basePortfolio(), 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      basePortfolio(),
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    expect(explanations.repayment.costBenefit).toMatch(/not modeled/i);
    expect(explanations.additionalCollateral.costBenefit).toMatch(/not modeled/i);
  });

  it('V4 isolation: builds impact from real V4-dispatched before/after values, never falling back to V3 protocol.liquidationThreshold', () => {
    const v4Portfolio = basePortfolio({
      protocolVersion: 'v4',
      v4DebtState: { drawnDebt: 20000, premiumDebt: 0, baseDrawnApr: 0.05, riskPremium: 0 },
      // Deliberately different from protocol.liquidationThreshold (0.8) —
      // a test that silently used the V3 field would fail on an exact
      // numeric mismatch, the same discipline `summary.test.ts`'s own V4
      // dispatch tests already establish.
      v4CollateralRisk: { collateralFactor: 0.65, dynamicConfigKey: 1 },
    });
    const actionsResult = calculateTargetHealthFactorActions(v4Portfolio, 5, 'manual');
    expect(actionsResult.ok).toBe(true);
    if (!actionsResult.ok) return;

    const explanations = explainTargetHealthFactorActions(
      v4Portfolio,
      'portfolio-1',
      '2026-01-01T00:00:00.000Z',
      actionsResult.data,
      'High confidence',
    );

    // HF = 0.65 * 100000 / 20000 = 3.25, not the V3 value (4).
    expect(explanations.repayment.impact?.healthFactor.before).toBeCloseTo(3.25, 9);
    expect(explanations.repayment.applyProposal?.protocolVersion).toBe('v4');
  });
});

import { createFailure, createSuccess, type FormulaResult } from '../shared/result';
import type { PortfolioInput } from '../shared/types';
import { calculateAdditionalCollateralRecommendation } from './calculateAdditionalCollateralRecommendation';
import { calculateBorrowRecommendation } from './calculateBorrowRecommendation';
import { calculateLoopRecommendation } from './calculateLoopRecommendation';
import { calculateRepaymentRecommendation } from './calculateRepaymentRecommendation';
import type { Recommendation } from './types';

const FORMULA_ID = 'F-061';
const FORMULA_VERSION = '1.0';

export interface RecommendationRuleConfig {
  borrow: { userMinHealthFactor: number; targetDebtRatio: number };
  repayment: { targetHealthFactor: number };
  additionalCollateral: { targetHealthFactor: number };
  loop: {
    targetHealthFactor: number;
    loopBorrowPercentage: number;
    maxAcceptableAnnualInterestCost: number;
  };
}

export interface GenerateRecommendationsParams {
  portfolio: PortfolioInput;
  rules: RecommendationRuleConfig;
}

export interface UnavailableRecommendationCategory {
  category: string;
  reason: string;
}

export interface RecommendationSet {
  recommendations: Recommendation[];
  unavailableCategories: UnavailableRecommendationCategory[];
}

const UNAVAILABLE_CATEGORIES: UnavailableRecommendationCategory[] = [
  {
    category: 'safety',
    reason:
      'F-060 "Health Factor Recommendation" requires a risk-band scheme, and the documented bands disagree across README.md, 01_PRD.md REQ-001, 01_PRD.md REQ-005, and 02_Formulas.md F-026/F-060 themselves — see PROJECT_STATUS.md conflict #1.',
  },
  {
    category: 'interestCost',
    reason:
      'F-065 "Interest Warning" requires an "Expected Annual Portfolio Growth" figure with no formula or definition anywhere in 02_Formulas.md — the same gap that blocked part of M2-018\'s "Excessive cost" check.',
  },
];

/**
 * Recommendation Rule Framework — 06_TASKS.md M2-025 ("Implement
 * Recommendation Rule Framework").
 *
 * Runs every implemented recommendation rule against one portfolio and
 * returns the full deterministic result set in one call, per the DoD
 * ("recommendations are generated from explicit rules rather than opaque
 * AI behavior"). Of the six "Recommendation categories" 06_TASKS.md
 * M2-025 originally named (Safety / Debt management / Collateral
 * management / Interest cost / Leverage / Exit readiness), three are
 * implemented — Debt management (F-061, F-062), Collateral management
 * (F-063), and Leverage (F-064) — and two remain unavailable, itemized in
 * `unavailableCategories` with reasons rather than silently omitted:
 * Safety (F-060, blocked by the Health Factor risk-band conflict) and
 * Interest cost (F-065, no formula for its "Expected Annual Portfolio
 * Growth" input).
 *
 * **"Exit readiness" (PROJECT_STATUS.md conflict #11) — closed
 * WON'T-IMPLEMENT, not merely unavailable.** No Formula ID in the
 * Recommendation Engine chapter (F-060-F-069) ever named or implied it,
 * and no deterministic rule for it exists anywhere in this
 * specification; F-047 "Risk Reduction Efficiency" (a per-repayment-
 * dollar efficiency ratio, not a readiness judgment) was considered as a
 * mapping and explicitly declined. Since no future batch can implement
 * this category without first inventing a definition the specification
 * never supplied, it is removed from this Engine's own category set
 * entirely, not merely retained as a fourth documented gap alongside
 * Safety/Interest cost above — those two remain because a real,
 * potentially-resolvable specification gap blocks them; this one had no
 * specification to begin with. See `recommendationTaxonomy.ts`'s own
 * header comment for the identical decision on the UI-facing filter.
 *
 * Tagged F-061 as its primary Formula ID, since it has no dedicated ID of
 * its own (a task-level orchestrator, the same pattern established for
 * `calculateLoopStrategy` F-018 and `simulatePriceScenario` F-050).
 */
export function generateRecommendations(
  params: GenerateRecommendationsParams,
): FormulaResult<RecommendationSet> {
  const options = {
    formulaId: FORMULA_ID,
    formulaVersion: FORMULA_VERSION,
    inputsUsed: { ...params },
  };

  const { portfolio, rules } = params;

  const borrowResult = calculateBorrowRecommendation({ portfolio, ...rules.borrow });
  if (!borrowResult.ok) return createFailure(borrowResult.error, options);

  const repaymentResult = calculateRepaymentRecommendation({ portfolio, ...rules.repayment });
  if (!repaymentResult.ok) return createFailure(repaymentResult.error, options);

  const additionalCollateralResult = calculateAdditionalCollateralRecommendation({
    portfolio,
    ...rules.additionalCollateral,
  });
  if (!additionalCollateralResult.ok)
    return createFailure(additionalCollateralResult.error, options);

  const loopResult = calculateLoopRecommendation({ portfolio, ...rules.loop });
  if (!loopResult.ok) return createFailure(loopResult.error, options);

  const warnings = [
    ...borrowResult.warnings,
    ...repaymentResult.warnings,
    ...additionalCollateralResult.warnings,
    ...loopResult.warnings,
  ];

  return createSuccess(
    {
      recommendations: [
        borrowResult.value,
        repaymentResult.value,
        additionalCollateralResult.value,
        loopResult.value,
      ],
      unavailableCategories: UNAVAILABLE_CATEGORIES,
    },
    options,
    warnings,
  );
}

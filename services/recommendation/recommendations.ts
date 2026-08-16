/**
 * Recommendation Service — 06_TASKS.md M3-012 ("Implement Recommendation
 * Service"): "Generate transparent recommendations from calculated
 * portfolio data." Include: Priority, Category, Risk level, Explanation,
 * Suggested action, Expected effect, Relevant Formula IDs. DoD:
 * "Recommendations are deterministic, explainable, and ordered
 * consistently."
 *
 * A single Engine call: `generateRecommendations` (M2-025/M2-026,
 * `@/engine`) already composes all four implemented recommendation rules
 * (Debt management, Repayment, Additional Collateral, Leverage/Loop) into
 * one `RecommendationSet`, each entry already carrying exactly M2-026's
 * six required fields — category, triggeringCondition ("Explanation"),
 * relevantValues, expectedEffect, decisionPriority ("Risk level"),
 * suggestedAction, formulaReferences ("Relevant Formula IDs"). No
 * multi-call composition or formula-version tracking is needed here,
 * unlike M3-005/M3-009.
 *
 * **"Priority" — the one field `generateRecommendations` doesn't already
 * provide.** `engine/recommendation/types.ts` documents an explicit,
 * ordered five-tier "DECISION PRIORITY" list (Prevent Liquidation >
 * Maintain Target Health Factor > Reduce Interest Costs > Improve
 * Capital Efficiency > Achieve User Goals — 02_Formulas.md's Recommendation
 * Engine chapter, page 8), already used as `Recommendation.decisionPriority`
 * ("Risk level"). `generateRecommendations` itself returns recommendations
 * in a fixed structural order (borrow, repayment, additionalCollateral,
 * loop), not priority-ordered. This Service sorts by that same documented
 * tier order and attaches a 1-based `priority` rank — satisfying both
 * M3-012's own "Priority" field and the DoD's "ordered consistently"
 * without inventing a new priority scheme (the tiers and their order are
 * the Formula chapter's own, not invented here).
 *
 * **`RecommendationRuleConfig` is entirely caller-supplied.** Thresholds
 * like `userMinHealthFactor`, `targetDebtRatio`, `targetHealthFactor`,
 * `loopBorrowPercentage`, and `maxAcceptableAnnualInterestCost` are
 * portfolio-owner preferences with no documented default value anywhere
 * — inventing defaults would mean guessing at user intent, so this
 * Service requires them as an explicit parameter, the same "never
 * fabricate what the Service doesn't own" principle as `sourceStatus`.
 *
 * **`unavailableCategories` is preserved, not dropped.** `generateRecommendations`
 * already reports which of the six documented recommendation categories
 * (Safety, Interest cost, Exit readiness) are unavailable and why —
 * dropping that here would silently hide real, already-documented
 * specification gaps (conflicts #1, #7-adjacent, #11) from anything
 * consuming this Service.
 */
import {
  type DecisionPriority,
  generateRecommendations,
  type Recommendation,
  type RecommendationRuleConfig,
  type UnavailableRecommendationCategory,
} from '@/engine';

import {
  checkAaveV4DebtStateAvailable,
  mapApplicationPortfolioToEngineInput,
} from '../portfolio/mapping';
import type { ApplicationPortfolio } from '../portfolio/models';
import { type ApplicationError, createApplicationError } from '../shared/errors';
import { createServiceFailure, createServiceSuccess, type ServiceResult } from '../shared/result';

/** 02_Formulas.md's Recommendation Engine chapter (page 8) "DECISION PRIORITY" order, highest first. */
const DECISION_PRIORITY_ORDER: DecisionPriority[] = [
  'Prevent Liquidation',
  'Maintain Target Health Factor',
  'Reduce Interest Costs',
  'Improve Capital Efficiency',
  'Achieve User Goals',
];

export interface RankedRecommendation extends Recommendation {
  /** 1-based rank per the documented Decision Priority order (1 = highest priority). */
  priority: number;
}

export interface RecommendationResult {
  recommendations: RankedRecommendation[];
  unavailableCategories: UnavailableRecommendationCategory[];
}

/**
 * Generates a deterministic, priority-ordered recommendation set —
 * 06_TASKS.md M3-012. `rules` and `sourceStatus` are caller-supplied
 * (see this file's header comment); neither is fabricated here.
 */
export function generateRecommendationSet(
  portfolio: ApplicationPortfolio,
  rules: RecommendationRuleConfig,
  sourceStatus: string,
): ServiceResult<RecommendationResult> {
  const engineInput = mapApplicationPortfolioToEngineInput(portfolio);
  const result = generateRecommendations({ portfolio: engineInput, rules });

  if (!result.ok) {
    const error: ApplicationError = createApplicationError(
      'calculation',
      result.error.code,
      result.error.message,
    );
    return createServiceFailure([error], {
      sourceStatus,
      engineVersion: result.metadata.engineVersion,
      formulaVersion: result.metadata.formulaVersion,
    });
  }

  // V4 Readiness Audit §12 Stage 10 — `generateRecommendations` above
  // already ran against `engineInput`, which silently falls back to
  // legacy `debt.balance` for a V4 portfolio with no synced `v4DebtState`
  // (`mapApplicationPortfolioToEngineInput`'s own documented gap). Fail
  // closed here, discarding that result, rather than returning
  // recommendations computed from stale debt.
  const v4GuardFailure = checkAaveV4DebtStateAvailable(
    portfolio,
    {
      engineVersion: result.metadata.engineVersion,
      formulaVersion: result.metadata.formulaVersion,
    },
    sourceStatus,
  );
  if (v4GuardFailure !== null) return v4GuardFailure;

  const ranked: RankedRecommendation[] = [...result.value.recommendations]
    .sort(
      (a, b) =>
        DECISION_PRIORITY_ORDER.indexOf(a.decisionPriority) -
        DECISION_PRIORITY_ORDER.indexOf(b.decisionPriority),
    )
    .map((recommendation, index) => ({ ...recommendation, priority: index + 1 }));

  return createServiceSuccess(
    { recommendations: ranked, unavailableCategories: result.value.unavailableCategories },
    {
      sourceStatus,
      engineVersion: result.metadata.engineVersion,
      formulaVersion: result.metadata.formulaVersion,
    },
    result.warnings,
  );
}

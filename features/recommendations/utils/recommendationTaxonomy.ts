import type { DecisionPriority, Recommendation, RecommendationCategory } from '@/services';
import type {
  RecommendationFilterCategory,
  RecommendationItemId,
} from '@/stores/recommendationCenterStore';

/**
 * Recommendation Center taxonomy — 06_TASKS.md M7-032 ("Implement
 * Recommendation List"). Group by: "Critical / High / Medium /
 * Informational." Filter by: "Safety / Debt / Collateral / Interest /
 * Leverage / Exit readiness."
 *
 * **No Formula ID governs either scheme — both are display mappings
 * derived from already-implemented, already-documented values, not new
 * calculations.** `02_Formulas.md`'s Recommendation Engine chapter
 * (page 8) documents exactly one ordering rule, the five-tier "DECISION
 * PRIORITY" list, already implemented as `DecisionPriority` (`@/engine`)
 * and already used by `services/recommendation/recommendations.ts`'s own
 * `DECISION_PRIORITY_ORDER`. Neither that chapter nor any other names a
 * four-bucket Critical/High/Medium/Informational severity scheme or a
 * six-category filter taxonomy — `SEVERITY_BY_DECISION_PRIORITY` below
 * buckets the five documented tiers into the four requested labels,
 * preserving their documented order and their "safety always higher
 * than profitability" invariant exactly; it invents no new threshold or
 * priority rule of its own. The same "translate an existing, ordered
 * Engine concept into a UI-only display bucket" pattern
 * `stores/loopBuilderStore.ts`'s `CHECK_CATEGORY` map and
 * `stores/exitPlannerStore.ts`'s `EXIT_TYPE_SUGGESTED_ADJUSTMENT` map
 * already established for Loop Builder and Exit Planner.
 *
 * **Only two of the six filter categories are ever populated with a
 * real recommendation in this Recommendation Center — see
 * `stores/recommendationCenterStore.ts`'s own header comment for why
 * `borrow`/`leverage` recommendations are not computed here at all**
 * (PROJECT_STATUS.md conflict #29: `generateRecommendationSet`'s
 * `RecommendationRuleConfig` needs four preference values —
 * `userMinHealthFactor`, `targetDebtRatio`, `loopBorrowPercentage`,
 * `maxAcceptableAnnualInterestCost` — with no portfolio-level source and
 * no documented default anywhere; inventing them would mean guessing at
 * user intent, the same reasoning that Service's own header comment
 * already gives for why `calculateTargetHealthFactorActions` exists as
 * a separate, narrower alternative). `UNAVAILABLE_FILTER_REASONS` below
 * covers the remaining four filter categories — `safety`/`interestCost`/
 * `exitReadiness` restate (not re-import) the exact same three reasons
 * `engine/recommendation/generateRecommendations.ts`'s own local
 * `UNAVAILABLE_CATEGORIES` constant already documents (that constant is
 * not exported; duplicating its three short, stable, conflict-citing
 * strings here — the same "each component owns its own small static
 * label map" precedent `FullExitResult.tsx`'s/`PartialExitResult.tsx`'s
 * own independently-declared `UNAVAILABLE_COST_LABELS` maps already
 * established — was judged lower-risk than the corresponding Engine
 * export, since the task instructions ask Engine changes to be avoided
 * unless "absolutely required," and duplicating three short strings is
 * not); `leverage` adds a fourth, Recommendation-Center-specific reason
 * of its own (Conflict #29, not an Engine-level gap — F-064 is fully
 * implemented, just not called by this route).
 */
export type RecommendationSeverity = 'Critical' | 'High' | 'Medium' | 'Informational';

export const SEVERITY_ORDER: RecommendationSeverity[] = [
  'Critical',
  'High',
  'Medium',
  'Informational',
];

const SEVERITY_BY_DECISION_PRIORITY: Record<DecisionPriority, RecommendationSeverity> = {
  'Prevent Liquidation': 'Critical',
  'Maintain Target Health Factor': 'High',
  'Reduce Interest Costs': 'Medium',
  'Improve Capital Efficiency': 'Medium',
  'Achieve User Goals': 'Informational',
};

/**
 * Whether a computed recommendation has a real, non-zero action to take —
 * V1.1 Batch 5, Section 6/9. Both `calculateRepaymentRecommendation`
 * (F-062) and `calculateAdditionalCollateralRecommendation` (F-063)
 * always return a `Recommendation` object even when nothing needs to
 * change (`requiredRepayment`/`requiredUsd` clamped to `0`,
 * `suggestedAction: 'No repayment/collateral needed.'`) — the ENGINE's
 * own "state the current-state trigger regardless" contract (M2-026).
 * This is the one place that decides, from the same two fixed
 * `relevantValues` keys `RecommendationDetailPanel.tsx`'s own
 * `isActionable` already reads, whether that object represents a real
 * suggestion or a "you're fine" confirmation — centralized here (not
 * duplicated per-component) so `severityFor` and the Detail Panel's
 * action-link gating can never disagree about which case they're in.
 */
export function isActionableRecommendation(
  id: RecommendationItemId,
  recommendation: Recommendation,
): boolean {
  return id === 'repayment'
    ? recommendation.relevantValues.requiredRepayment > 0
    : recommendation.relevantValues.requiredUsd > 0;
}

/**
 * Severity — Section 6/9. A non-actionable recommendation ("no action
 * needed") is always `'Informational'`, regardless of its
 * `decisionPriority` — a "you're fine" confirmation must never sit in the
 * same visual tier as a real, urgent action, even though both
 * `repayment`/`additionalCollateral` share the identical hardcoded
 * `'Maintain Target Health Factor'` decision priority today (see
 * `RecommendationList.tsx`'s own `sortItems` comment on why the priority
 * comparison itself is currently a no-op). This is the one real ranking
 * change this batch makes: it does not reorder actionable recommendations
 * relative to each other (nothing in this Recommendation Center yet
 * produces two actionable items at different decision priorities — see
 * PROJECT_STATUS.md conflict #29), it only demotes a non-actionable one
 * out of the tier a real action would occupy.
 */
export function severityFor(
  id: RecommendationItemId,
  recommendation: Recommendation,
): RecommendationSeverity {
  if (!isActionableRecommendation(id, recommendation)) return 'Informational';
  return SEVERITY_BY_DECISION_PRIORITY[recommendation.decisionPriority];
}

export const RECOMMENDATION_FILTER_CATEGORIES: {
  id: RecommendationFilterCategory;
  label: string;
}[] = [
  { id: 'safety', label: 'Safety' },
  { id: 'debt', label: 'Debt' },
  { id: 'collateral', label: 'Collateral' },
  { id: 'interest', label: 'Interest' },
  { id: 'leverage', label: 'Leverage' },
  { id: 'exitReadiness', label: 'Exit Readiness' },
];

const FILTER_CATEGORY_BY_RECOMMENDATION_CATEGORY: Record<
  RecommendationCategory,
  RecommendationFilterCategory
> = {
  debtManagement: 'debt',
  collateralManagement: 'collateral',
  leverage: 'leverage',
};

export function filterCategoryFor(recommendation: Recommendation): RecommendationFilterCategory {
  return FILTER_CATEGORY_BY_RECOMMENDATION_CATEGORY[recommendation.category];
}

export const UNAVAILABLE_FILTER_REASONS: Partial<Record<RecommendationFilterCategory, string>> = {
  safety:
    'F-060 "Health Factor Recommendation" requires a risk-band scheme, and the documented bands disagree across README.md, 01_PRD.md REQ-001, 01_PRD.md REQ-005, and 02_Formulas.md F-026/F-060 themselves — see PROJECT_STATUS.md conflict #1.',
  interest:
    'F-065 "Interest Warning" requires an "Expected Annual Portfolio Growth" figure with no formula or definition anywhere in 02_Formulas.md.',
  exitReadiness:
    'No Formula ID in the Recommendation Engine chapter (F-060-F-069) maps to "Exit readiness" specifically; implementing one would mean inventing a rule not documented anywhere.',
  leverage:
    'F-064 "Loop Recommendation" is implemented, but requires a loop-borrow-percentage and a maximum-acceptable-annual-interest-cost preference — neither has a portfolio-level source or a documented default anywhere (PROJECT_STATUS.md conflict #29); inventing values would mean guessing at user intent.',
};

/**
 * Human-readable labels for the two fixed `relevantValues` key sets this
 * Recommendation Center ever displays (`calculateRepaymentRecommendation`
 * F-062 and `calculateAdditionalCollateralRecommendation` F-063, both
 * `engine/recommendation/`) — exhaustive per-key maps, the same
 * `UNAVAILABLE_COST_LABELS`-style explicit-label-map precedent, chosen
 * over a generic camelCase-to-Title-Case formatter so every label is
 * reviewed and traceable rather than mechanically derived.
 */
export const REPAYMENT_VALUE_LABELS: Record<string, string> = {
  currentDebt: 'Current Debt',
  targetDebt: 'Target Debt',
  targetHealthFactor: 'Target Health Factor',
  requiredRepayment: 'Required Repayment',
  estimatedBtcRequired: 'Estimated BTC Required',
};

export const ADDITIONAL_COLLATERAL_VALUE_LABELS: Record<string, string> = {
  currentCollateralValue: 'Current Collateral Value',
  targetCollateralValue: 'Target Collateral Value',
  targetHealthFactor: 'Target Health Factor',
  requiredUsd: 'Required Additional Collateral (USD)',
  equivalentBtc: 'Equivalent BTC',
};

/** Keys whose value is a BTC quantity, not a currency amount or ratio — for display formatting only. */
export const BTC_VALUE_KEYS = new Set(['estimatedBtcRequired', 'equivalentBtc']);

/** Keys whose value is a Health Factor ratio, not a currency amount — for display formatting only. */
export const HEALTH_FACTOR_VALUE_KEYS = new Set(['targetHealthFactor']);

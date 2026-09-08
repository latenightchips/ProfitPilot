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
 * **v1.18.0 Batch 3** (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * §8) — `borrow`/`loop` are no longer permanently unpopulated. Conflict
 * #29's sourcing gap is resolved (Batch 1/2): `stores/recommendationCenterStore.ts`
 * now calls `calculateRecommendationActions`, which computes `borrow`/
 * `loop` whenever this portfolio's own `recommendationPreferences` are
 * complete for that rule. `FILTER_CATEGORY_BY_RECOMMENDATION_CATEGORY`
 * below needed **no code change** for this — F-061 Borrow's own Engine
 * `category` is `'debtManagement'`, identical to F-062 Repayment's, so
 * the existing `debtManagement: 'debt'` entry already covers both; only
 * `leverage`'s entry in `UNAVAILABLE_FILTER_REASONS` (below) is removed,
 * since that category is no longer permanently blocked — its
 * availability now depends on this portfolio's own configuration, a
 * per-portfolio state `RecommendationList.tsx` reads from the Store's own
 * `unavailableReasons.loop` (spec §8), not a static string here.
 *
 * **`safety`/`interest`/`exitReadiness` remain permanently unavailable,
 * unchanged by this batch** — restate (not re-import) the exact same
 * three reasons `engine/recommendation/generateRecommendations.ts`'s own
 * local `UNAVAILABLE_CATEGORIES` constant already documents (that
 * constant is not exported; duplicating its three short, stable,
 * conflict-citing strings here — the same "each component owns its own
 * small static label map" precedent `FullExitResult.tsx`'s/
 * `PartialExitResult.tsx`'s own independently-declared
 * `UNAVAILABLE_COST_LABELS` maps already established — was judged
 * lower-risk than the corresponding Engine export, since the task
 * instructions ask Engine changes to be avoided unless "absolutely
 * required," and duplicating three short strings is not).
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
 *
 * **`borrow`/`loop` (v1.18.0 Batch 3, spec §8)** — unlike Repayment/
 * Additional Collateral, F-061/F-064 are binary accept/reject
 * recommendations with no numeric "how much" `relevantValues` key to
 * check against zero. Spec §8's own Decision: treat "acceptable"/"loop
 * recommended" as the non-actionable case (current state is fine,
 * nothing to flag) and "not acceptable"/"stop looping" as the actionable
 * one (worth a real severity tier, not `'Informational'`) — mirroring
 * this function's own "a confirmation must never sit at the same tier as
 * a real action" principle, applied to Borrow/Loop's binary shape.
 * Derived by re-applying F-061's/F-064's own already-documented
 * "Conditions" comparisons (`02_Formulas.md` page 8) directly to their
 * already-computed `relevantValues` — not a new calculation, and not the
 * spec's own illustrative pseudocode's `relevantValues.debtRatioOk` (no
 * such boolean field exists on the real `relevantValues` shape,
 * confirmed against `calculateBorrowRecommendation.ts`/
 * `calculateLoopRecommendation.ts`'s own literal `relevantValues`
 * objects — the pseudocode's intent, not its exact property name, is
 * what's implemented here).
 */
export function isActionableRecommendation(
  id: RecommendationItemId,
  recommendation: Recommendation,
): boolean {
  if (id === 'repayment') return recommendation.relevantValues.requiredRepayment > 0;
  if (id === 'additionalCollateral') return recommendation.relevantValues.requiredUsd > 0;
  if (id === 'borrow') {
    const { healthFactor, userMinHealthFactor, availableBorrow, debtRatio, targetDebtRatio } =
      recommendation.relevantValues;
    const acceptable =
      healthFactor > userMinHealthFactor && availableBorrow > 0 && debtRatio < targetDebtRatio;
    return !acceptable;
  }
  const {
    newHealthFactor,
    targetHealthFactor,
    availableBorrow: loopAvailableBorrow,
    annualInterestCost,
    maxAcceptableAnnualInterestCost,
  } = recommendation.relevantValues;
  const loopRecommended =
    newHealthFactor > targetHealthFactor &&
    loopAvailableBorrow > 0 &&
    annualInterestCost <= maxAcceptableAnnualInterestCost;
  return !loopRecommended;
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

/**
 * The three categories still permanently blocked, unaffected by this
 * batch. `leverage` is deliberately **not** listed here anymore
 * (v1.18.0 Batch 3, spec §8) — its availability now depends on this
 * portfolio's own `recommendationPreferences.loop`, so a static
 * "always unavailable" string would become actively wrong the moment a
 * user configures it. `RecommendationList.tsx` sources `leverage`'s
 * per-portfolio-state reason from the Store's own `unavailableReasons.loop`
 * instead (`calculateRecommendationActions`, Batch 2).
 */
export const UNAVAILABLE_FILTER_REASONS: Partial<Record<RecommendationFilterCategory, string>> = {
  safety:
    'F-060 "Health Factor Recommendation" requires a risk-band scheme, and the documented bands disagree across README.md, 01_PRD.md REQ-001, 01_PRD.md REQ-005, and 02_Formulas.md F-026/F-060 themselves — see PROJECT_STATUS.md conflict #1.',
  interest:
    'F-065 "Interest Warning" requires an "Expected Annual Portfolio Growth" figure with no formula or definition anywhere in 02_Formulas.md.',
  exitReadiness:
    'No Formula ID in the Recommendation Engine chapter (F-060-F-069) maps to "Exit readiness" specifically; implementing one would mean inventing a rule not documented anywhere.',
};

/**
 * Which filter category each item id belongs to, addressable even when
 * the item was never computed (v1.18.0 Batch 3) — `filterCategoryFor`
 * above needs a real `Recommendation.category` to read, which an
 * unavailable `borrow`/`loop` item doesn't have. Not a new taxonomy: the
 * same category assignments `FILTER_CATEGORY_BY_RECOMMENDATION_CATEGORY`
 * already encodes (`debtManagement`→`'debt'`, `collateralManagement`→`'collateral'`,
 * `leverage`→`'leverage'`), restated per item id so `RecommendationList.tsx`
 * can show an unavailable item's reason under the correct filter tab.
 */
export const ITEM_FILTER_CATEGORY: Record<RecommendationItemId, RecommendationFilterCategory> = {
  repayment: 'debt',
  additionalCollateral: 'collateral',
  borrow: 'debt',
  loop: 'leverage',
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

/**
 * F-061 Borrow's exact `relevantValues` keys (v1.18.0 Batch 3) —
 * `calculateBorrowRecommendation.ts`'s own literal object, the same
 * exhaustive, explicit-label-map precedent as the two maps above.
 */
export const BORROW_VALUE_LABELS: Record<string, string> = {
  healthFactor: 'Health Factor',
  userMinHealthFactor: 'Minimum Health Factor',
  availableBorrow: 'Available Borrow',
  debtRatio: 'Debt Ratio',
  targetDebtRatio: 'Target Debt Ratio',
};

/**
 * F-064 Loop's exact `relevantValues` keys (v1.18.0 Batch 3) —
 * `calculateLoopRecommendation.ts`'s own literal object.
 */
export const LOOP_VALUE_LABELS: Record<string, string> = {
  newHealthFactor: 'Health Factor After Loop',
  targetHealthFactor: 'Target Health Factor',
  availableBorrow: 'Available Borrow',
  annualInterestCost: 'Annual Interest Cost',
  maxAcceptableAnnualInterestCost: 'Maximum Acceptable Annual Interest Cost',
};

/** Keys whose value is a BTC quantity, not a currency amount or ratio — for display formatting only. */
export const BTC_VALUE_KEYS = new Set(['estimatedBtcRequired', 'equivalentBtc']);

/** Keys whose value is a Health Factor ratio, not a currency amount — for display formatting only. */
export const HEALTH_FACTOR_VALUE_KEYS = new Set([
  'targetHealthFactor',
  'healthFactor',
  'userMinHealthFactor',
  'newHealthFactor',
]);

/** Keys whose value is a percentage/ratio, not a currency amount — for display formatting only (v1.18.0 Batch 3). */
export const PERCENT_VALUE_KEYS = new Set(['debtRatio', 'targetDebtRatio']);

/**
 * User-facing presentation text for Borrow/Loop — v1.18.0 Batch 4
 * (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §10). Only
 * `borrow`/`loop`'s "Triggering Condition"/"Suggested Action" display
 * slots are ever routed through this function — `repayment`/
 * `additionalCollateral` are deliberately excluded from its own
 * parameter type, since spec §10 states their existing copy is **not
 * changed** ("it already reads as a conditional restatement of the
 * user's own target, not a naked directive"); `RecommendationList.tsx`/
 * `RecommendationDetailPanel.tsx` keep reading `.triggeringCondition`/
 * `.suggestedAction` directly for those two ids.
 *
 * **`headline` is `recommendation.triggeringCondition`, unaltered.** Spec
 * §10's own "Design rule" is explicit that presentation "attributes the
 * threshold to 'your configured' preference... without altering
 * `triggeringCondition`'s own value" — the raw, factual condition
 * statement ("One or more of: Health Factor at or below minimum...") is
 * not itself a directive imperative the way `suggestedAction` is, so
 * nothing in §10 proposes new wording for it. Sourcing it through this
 * function (rather than reading it directly at the call site) keeps both
 * display-slot decisions for Borrow/Loop in one place, matching spec
 * §10's own description of the return shape, without inventing new
 * headline copy the spec never supplied.
 *
 * **`detail` replaces the raw, directive `suggestedAction`** ("Stop
 * Looping.", "Do not recommend additional borrowing.") with spec §10's
 * own exact proposed sentence for the matching condition — reusing
 * `isActionableRecommendation`'s already-derived boolean (inverted: the
 * *non*-actionable case is the "acceptable"/"loop recommended" row of
 * §10's table) rather than re-deriving F-061's/F-064's own "Conditions"
 * comparisons a second time, so the two functions can never disagree
 * about which case a given `Recommendation` is in.
 *
 * **The raw `suggestedAction` string is never hidden** — spec §10's own
 * "ENGINE OUTPUT / TRACEABILITY" guarantee ("These remain fully
 * inspectable... never hidden"). `RecommendationDetailPanel.tsx` renders
 * it as a small, separately labeled line alongside this function's
 * `detail` text, not merely replaced by it.
 */
export function presentationTextFor(
  id: 'borrow' | 'loop',
  recommendation: Recommendation,
): { headline: string; detail: string } {
  const headline = recommendation.triggeringCondition;
  const conditionMet = !isActionableRecommendation(id, recommendation);
  if (id === 'borrow') {
    return {
      headline,
      detail: conditionMet
        ? 'Based on your configured minimum Health Factor and target Debt Ratio, an additional borrow currently stays within your configured limits.'
        : 'An additional borrow would currently exceed at least one of your configured limits — minimum Health Factor or target Debt Ratio.',
    };
  }
  return {
    headline,
    detail: conditionMet
      ? 'Based on your configured Loop preferences, one more loop step currently stays within your configured Health Factor, borrow-capacity, and interest-cost limits.'
      : 'One more loop step would currently exceed at least one of your configured Loop limits — target Health Factor, available borrow capacity, or maximum acceptable interest cost.',
  };
}

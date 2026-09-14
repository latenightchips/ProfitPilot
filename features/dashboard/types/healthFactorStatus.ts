import type { RiskCategory } from '@/services';

/**
 * Health Factor Status types — 06_TASKS.md M5-007 ("Implement Health
 * Factor Status Component"). Dependencies: M5-003. DoD: "The user can
 * understand both the numeric value and its practical meaning."
 *
 * **"Risk classification" — now modeled as `riskCategory`, PROJECT_STATUS.md
 * conflict #1 closed.** M5-007's own Display list named it; Conflict #1
 * (Health Factor risk-band thresholds disagreeing across four documents —
 * README.md/REQ-001, REQ-005, F-026, F-060) blocked it from Milestone 2
 * Batch 3 onward. An explicit owner decision resolved the disagreement:
 * one canonical classification (`calculateRiskCategory`, F-026,
 * `@/services`), with `01_PRD.md` REQ-005-A as the chosen basis and its
 * own historical overlapping boundaries made mutually exclusive. This
 * Dashboard surface calls that same function directly — never a second,
 * independently-maintained threshold table — so it can never disagree
 * with F-060's own guidance or the Recommendation Center's `healthFactor`
 * item over the identical Health Factor value.
 *
 * **"Required action to restore target" — `requiredActions`, sourced
 * from a new Service (`calculateTargetHealthFactorActions`, added this
 * batch), not `generateRecommendationSet` (M3-012).** That Service needs
 * a full `RecommendationRuleConfig` with five fields no `Portfolio` field
 * carries and no specification page defaults — see PROJECT_STATUS.md
 * conflict #29. `calculateTargetHealthFactorActions` needs only the
 * portfolio's own `settings.safetyTargets.targetHealthFactor` (already a
 * real field, M4-001), so `requiredActions` is only ever non-null when a
 * portfolio has that target configured — "where available," read
 * literally.
 */
export interface HealthFactorStatus {
  currentHealthFactor: number;
  formattedCurrentHealthFactor: string;
  /**
   * `calculateRiskCategory`'s own result for `currentHealthFactor`.
   * `null` only if that call itself fails (NaN/negative Health Factor) —
   * unreachable in practice, since `currentHealthFactor` always comes
   * from an already-successful `PortfolioSummary`, but never fabricated
   * rather than risking a silently-wrong classification.
   */
  riskCategory: RiskCategory | null;
  /** `null` when no target is configured (`Portfolio.settings.safetyTargets.targetHealthFactor` unset). */
  configuredTarget: number | null;
  formattedConfiguredTarget: string | null;
  /** `currentHealthFactor - configuredTarget`. `null` whenever `configuredTarget` is `null`. */
  distanceFromTarget: number | null;
  formattedDistanceFromTarget: string | null;
  /** Directional only ("above"/"at"/"below") — a separate, target-relative signal from `riskCategory` (an absolute one); see this file's own header comment. */
  explanation: string;
  /**
   * Both alternative, Engine-generated `suggestedAction` strings
   * (F-062 repayment, F-063 additional collateral), verbatim — not
   * reworded or merged into one sentence. `null` when no target is
   * configured, or the underlying Service call fails.
   */
  requiredActions: { repayment: string; additionalCollateral: string } | null;
}

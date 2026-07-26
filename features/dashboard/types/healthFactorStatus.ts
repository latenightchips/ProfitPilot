/**
 * Health Factor Status types — 06_TASKS.md M5-007 ("Implement Health
 * Factor Status Component"). Dependencies: M5-003. DoD: "The user can
 * understand both the numeric value and its practical meaning."
 *
 * **"Risk classification" — not modeled here.** M5-007's own Display
 * list names it, but Conflict #1 (Health Factor risk-band thresholds
 * disagree across four documents — README.md/REQ-001, REQ-005, F-026,
 * F-060) blocks it: F-026 (the Engine's own Risk Category formula) was
 * never implemented for exactly this reason (Milestone 2 Batch 3),
 * and nothing in this codebase can honestly classify a Health Factor
 * into a named risk band without picking a scheme nothing in the
 * specification designates as canonical. See PROJECT_STATUS.md conflict
 * #1 — unchanged by this batch, not re-litigated here.
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
  /** `null` when no target is configured (`Portfolio.settings.safetyTargets.targetHealthFactor` unset). */
  configuredTarget: number | null;
  formattedConfiguredTarget: string | null;
  /** `currentHealthFactor - configuredTarget`. `null` whenever `configuredTarget` is `null`. */
  distanceFromTarget: number | null;
  formattedDistanceFromTarget: string | null;
  /** Directional only ("above"/"at"/"below") — never a risk-band label; see this file's own header comment. */
  explanation: string;
  /**
   * Both alternative, Engine-generated `suggestedAction` strings
   * (F-062 repayment, F-063 additional collateral), verbatim — not
   * reworded or merged into one sentence. `null` when no target is
   * configured, or the underlying Service call fails.
   */
  requiredActions: { repayment: string; additionalCollateral: string } | null;
}

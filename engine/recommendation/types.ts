/**
 * Shared Recommendation shape — 06_TASKS.md M2-026 ("Implement
 * Recommendation Explanations"). Every recommendation-producing function
 * in this module returns one of these, satisfying M2-026's six required
 * fields (Triggering condition, Relevant values, Expected effect, Risk
 * level, Suggested action, Formula references) from the moment it is
 * created — M2-026 adds no new Formula ID of its own, only this shape
 * requirement on M2-025's outputs.
 */

/**
 * 02_Formulas.md's Recommendation Engine chapter (page 8) documents an
 * explicit, ordered "DECISION PRIORITY" list ("Safety always has higher
 * priority than profitability"). `decisionPriority` uses those exact five
 * documented tiers as the "Risk level" M2-026 requires, rather than the
 * numeric Health Factor risk bands that disagree across documents
 * (PROJECT_STATUS.md conflict #1) — this field never depends on that
 * unresolved conflict.
 */
export type DecisionPriority =
  | 'Prevent Liquidation'
  | 'Maintain Target Health Factor'
  | 'Reduce Interest Costs'
  | 'Improve Capital Efficiency'
  | 'Achieve User Goals';

export type RecommendationCategory = 'debtManagement' | 'collateralManagement' | 'leverage';

export interface Recommendation {
  category: RecommendationCategory;
  /** M2-026: "Triggering condition". */
  triggeringCondition: string;
  /** M2-026: "Relevant values". */
  relevantValues: Record<string, number>;
  /** M2-026: "Expected effect". */
  expectedEffect: string;
  /** M2-026: "Risk level". */
  decisionPriority: DecisionPriority;
  /** M2-026: "Suggested action". */
  suggestedAction: string;
  /** M2-026: "Formula references". */
  formulaReferences: string[];
}

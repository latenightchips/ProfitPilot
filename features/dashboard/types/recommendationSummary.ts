/**
 * Recommendation Summary types — 06_TASKS.md M5-015 ("Implement
 * Recommendation Summary"). Dependencies: M3-012, M5-003. DoD:
 * "Recommendations are transparent and traceable to deterministic
 * rules."
 *
 * **Deliberately reuses `calculateTargetHealthFactorActions` (Batch 4),
 * not `generateRecommendationSet` (M3-012) directly** — the same
 * scoping decision `HealthFactorStatus` (M5-007) and
 * `LiquidationRiskPanel` (M5-009) already made. `generateRecommendationSet`
 * requires a complete `RecommendationRuleConfig` (`borrow`, `repayment`,
 * `additionalCollateral`, `loop` — 7 fields as one non-optional object),
 * and 5 of those 7 fields have no source on `Portfolio`/`PortfolioSettings`
 * and no documented default anywhere (conflict #29, Batch 4). Rather
 * than invent them, this section shows exactly the same two
 * recommendations (repayment, additional collateral) that
 * `HealthFactorStatus`'s "Required action to restore target" already
 * computes — reformatted as a prioritized, traceable list per this
 * task's own Display fields, using the real `Recommendation` object each
 * Engine function already returns (category, decisionPriority,
 * triggeringCondition, suggestedAction, expectedEffect — M2-026's own
 * six-field contract), not a new shape invented for this Dashboard
 * section.
 *
 * **Only shown when a target Health Factor is configured, and only the
 * items that are actually actionable.** `calculateTargetHealthFactorActions`
 * runs unconditionally once a target exists, but its own two
 * `Recommendation`s report "No repayment needed." /
 * "No additional collateral needed." when the target is already met
 * (`relevantValues.requiredRepayment === 0` /
 * `relevantValues.requiredUsd === 0`, the Engine's own conditions, not
 * a threshold invented here) — those are filtered out rather than
 * padding a "Top Recommendations" list with non-actionable entries.
 * `items` is legitimately empty both when no target is configured and
 * when the target is already met; the borrow/loop categories
 * `generateRecommendationSet` would otherwise also compute are simply
 * outside this section's scope (conflict #29).
 *
 * **"Priority" is a 1-based rank**, reusing the exact same
 * `DECISION_PRIORITY_ORDER` tier list `services/recommendation/recommendations.ts`
 * (M3-012) already defines from `02_Formulas.md`'s own "DECISION
 * PRIORITY" chapter — not a new ordering scheme. Both possible items
 * here share the same tier ("Maintain Target Health Factor"), so rank
 * is a stable, deterministic list-order tiebreak (repayment, then
 * additional collateral) — not itself a documented rule, but a
 * necessary, honestly-labeled tiebreak for two items at one tier.
 *
 * **"View all action" — not built.** Every recommendation this section
 * can ever compute (at most 2, both at one tier) is already shown; there
 * is no larger set to reveal. Building a "View all" control with nothing
 * additional behind it would be the same kind of dead affordance M5-012's
 * chart was avoided for.
 *
 * **"Dismiss or acknowledge behavior only if documented" — not built.**
 * Neither term appears anywhere in `01_PRD.md`, `03_UI.md`, or
 * `04_BUILD_GUIDE.md` — the task's own conditional text is read
 * literally as "since it isn't documented, don't build it."
 *
 * **Note on 03_UI.md's own "PRIMARY RECOMMENDATION" mockup (Section 5)**:
 * that page states "Only one recommendation is displayed," while
 * 06_TASKS.md's M5-015 names "Top recommendations" (plural) with its own
 * "Priority" ranking field — a genuine terminology mismatch between the
 * two documents, not resolved here (06_TASKS.md is this project's
 * authoritative task backlog, per established practice throughout this
 * engagement). In practice this section's own real recommendation
 * universe is capped at 2 items regardless, softening the practical
 * difference.
 */
export interface RecommendationSummaryItem {
  priority: number;
  category: string;
  riskLevel: string;
  explanation: string;
  suggestedAction: string;
  expectedEffect: string;
}

export interface RecommendationSummary {
  items: RecommendationSummaryItem[];
}

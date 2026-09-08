/**
 * Recommendation Summary types — 06_TASKS.md M5-015 ("Implement
 * Recommendation Summary"). Dependencies: M3-012, M5-003. DoD:
 * "Recommendations are transparent and traceable to deterministic
 * rules."
 *
 * **v1.19.0 Batch 1** (Dashboard Recommendation Summary Parity) — the
 * builder now calls `calculateRecommendationActions` (v1.18.0 Batch 2),
 * not `calculateTargetHealthFactorActions`; see
 * `../utils/buildRecommendationSummary.ts`'s own header comment for the
 * full reasoning. Still not `generateRecommendationSet` (M3-012)
 * directly — `calculateRecommendationActions` already solves that
 * Service's all-or-nothing `RecommendationRuleConfig` problem (Conflict
 * #29) without inventing any of its 5 previously-unsourced preference
 * fields, and Batch 1's per-item preference gating is described below.
 *
 * **Only shown when a target Health Factor is configured, and only the
 * items that are actually actionable.** `calculateRecommendationActions`
 * runs Repayment/Additional Collateral unconditionally once a target
 * exists (unchanged from `calculateTargetHealthFactorActions`'s own
 * scope), and independently computes Borrow/Loop whenever this
 * portfolio's own `settings.recommendationPreferences` has that rule's
 * complete field pair (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * §5) — never a default, never a partial-group substitution. Every
 * computed item is then filtered through `isActionableRecommendation`
 * (`features/recommendations/utils/recommendationTaxonomy.ts`) before
 * appearing here — Repayment/Additional Collateral exactly as before
 * ("No repayment needed."/"No additional collateral needed." filtered
 * out), and Borrow/Loop by the same function's binary "acceptable"/"loop
 * recommended" condition (spec §8) — so an available-but-fine Borrow/Loop
 * item is excluded the same way an already-met Repayment/Additional
 * Collateral target is. `items` is legitimately empty when no target is
 * configured, when the target is already met, and now also when Borrow/
 * Loop (if configured) are both currently fine — `emptyReason` does not
 * distinguish which combination produced an empty list, only whether one
 * exists.
 *
 * **"Priority" is a 1-based rank**, reusing the exact same
 * `DECISION_PRIORITY_ORDER` tier list `services/recommendation/recommendations.ts`
 * (M3-012) already defines from `02_Formulas.md`'s own "DECISION
 * PRIORITY" chapter — not a new ordering scheme. Repayment/Additional
 * Collateral share one tier ("Maintain Target Health Factor"); Borrow/
 * Loop share a strictly lower one ("Improve Capital Efficiency") — rank
 * is a stable, deterministic list-order tiebreak within each tier
 * (`buildRecommendationSummary.ts`'s own `ITEM_ORDER`), not itself a
 * documented rule, but a necessary, honestly-labeled tiebreak for items
 * sharing one tier.
 *
 * **"View all action" — still not built (unchanged by Batch 1).** Every
 * recommendation this section can ever compute (at most 4 as of Batch 1,
 * proven from `RecommendationItemId`'s own four-member union) is already
 * shown; there is no larger set to reveal. Building a "View all" control
 * with nothing additional behind it would be the same kind of dead
 * affordance M5-012's chart was avoided for.
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
 * engagement).
 *
 * **`emptyReason` — added Batch 9 (M5-020, "Implement Dashboard Empty
 * States"), "No recommendations" Include item.** Batch 7 originally left
 * an empty `items` list to render nothing at all, reasoning "neither
 * [case] warrants an error or a misleading message" — that was a decision
 * not to fabricate an explanation without a concrete task asking for one.
 * M5-020 now asks for exactly that: "Each empty state explains the
 * missing requirement and provides a clear action." `emptyReason`
 * distinguishes the two real, already-established causes of an empty
 * `items` list (see `buildRecommendationSummary.ts`) so the component can
 * render an honest, case-specific explanation instead of silence:
 * `'no_target'` (no target Health Factor configured — actionable: set
 * one) and `'target_met'` (a target is configured, and nothing currently
 * computed is actionable — Repayment/Additional Collateral satisfied,
 * and, since v1.19.0 Batch 1, Borrow/Loop too if configured; informational,
 * not actionable; nothing is "missing" in this case, so the component
 * does not force an artificial call-to-action onto it). `'unavailable'`
 * covers the practically-unreachable case where `calculateRecommendationActions`
 * itself fails despite a successfully-computed `PortfolioSummary` (mirrors
 * the same "documented, not assumed reachable" caveat other Dashboard
 * builders already carry for their own edge cases).
 */
export interface RecommendationSummaryItem {
  priority: number;
  category: string;
  riskLevel: string;
  explanation: string;
  suggestedAction: string;
  expectedEffect: string;
}

export type RecommendationSummaryEmptyReason = 'no_target' | 'target_met' | 'unavailable';

export interface RecommendationSummary {
  items: RecommendationSummaryItem[];
  /** `null` whenever `items` is non-empty. */
  emptyReason: RecommendationSummaryEmptyReason | null;
}

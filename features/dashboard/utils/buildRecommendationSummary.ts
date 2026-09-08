/**
 * Recommendation Summary builder — 06_TASKS.md M5-015. See
 * `../types/recommendationSummary.ts` for the full design reasoning.
 *
 * **v1.19.0 Batch 1** (Dashboard Recommendation Summary Parity, Service
 * Integration) — switched from `calculateTargetHealthFactorActions` to
 * `calculateRecommendationActions` (v1.18.0 Batch 2,
 * `services/recommendation/recommendationActions.ts`), the same canonical
 * Service the Recommendation Center itself calls
 * (`stores/recommendationCenterStore.ts`). That Service already resolves
 * Conflict #29's sourcing gap: Repayment/Additional Collateral remain
 * unconditional once a target Health Factor exists (identical behavior to
 * the Service this replaces), and Borrow/Loop are computed independently,
 * each iff this portfolio's own `settings.recommendationPreferences` has
 * that rule's complete field pair (`docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * §5) — never a default, never a partial-group substitution. This file
 * still derives no financial semantics of its own: it only selects which
 * of the Service's own already-computed items are actionable and orders
 * them, exactly as it already did for Repayment/Additional Collateral.
 *
 * **`targetHealthFactor === null` is now read from the Service's own
 * result**, not derived here first. The previous version short-circuited
 * on `portfolio.settings.safetyTargets` before ever calling the Service,
 * because `calculateTargetHealthFactorActions` required a non-null target
 * as a parameter. `calculateRecommendationActions` reads
 * `targetHealthFactor` internally (spec §6.1 step 1) and reports it back
 * in its own result — this file now defers to that, the same "a Service
 * function owns its own gating" precedent already established for every
 * other Recommendation Center consumer. One behavioral nuance: a
 * `calculateCollateralValue` anchor call now runs even when no target is
 * configured (the Service's own unconditional anchor step) — a pure,
 * inexpensive read, not a new financial derivation, and already exactly
 * what happens on every Recommendation Center recalculation today.
 *
 * **Actionability filtering extends unchanged to Borrow/Loop.** Repayment/
 * Additional Collateral were already filtered by their own ">0" condition
 * before this batch; `isActionableRecommendation`
 * (`features/recommendations/utils/recommendationTaxonomy.ts`, the same
 * function the Recommendation Center itself uses to decide "no action
 * needed" vs. a real suggestion) is reused here instead of re-deriving
 * that ">0" check locally, and applied identically to Borrow/Loop's own
 * binary "acceptable" condition (spec §8) — so an available-but-fine
 * Borrow/Loop item is excluded from this summary exactly the same way an
 * already-met Repayment/Additional Collateral target is, not a new,
 * Dashboard-specific availability rule.
 *
 * **Item order** (`ITEM_ORDER` below) matches
 * `features/recommendations/components/RecommendationList.tsx`'s own
 * identical `ITEM_ORDER` constant, which itself matches the documented
 * "DECISION PRIORITY" tiers each item's `decisionPriority` already carries
 * (Repayment/Additional Collateral: "Maintain Target Health Factor";
 * Borrow/Loop: "Improve Capital Efficiency" — a strictly lower tier), with
 * a stable declaration-order tiebreak within a shared tier. Restated here
 * rather than imported, matching this codebase's own "each component owns
 * its own small static ordering" precedent (see e.g.
 * `UNAVAILABLE_FILTER_REASONS`'s restatement in `recommendationTaxonomy.ts`).
 *
 * **Maximum item count is now 4, not 2** — proven from
 * `RecommendationActionsResult.items`'s own `RecommendationItemId` union
 * (`'repayment' | 'additionalCollateral' | 'borrow' | 'loop'`, exactly
 * four members) and spec §5's independence guarantee (no item's
 * availability depends on another's), not assumed from the v1.19.0
 * roadmap audit's own suggestion.
 *
 * **Presentation-language boundary reused, not reinvented.** Borrow/Loop's
 * `explanation`/`suggestedAction` fields are sourced through
 * `presentationTextFor` (v1.18.0 Batch 4) exactly as
 * `RecommendationList.tsx`/`RecommendationDetailPanel.tsx` already do —
 * this Dashboard section never reads their raw `triggeringCondition`/
 * `suggestedAction` directly, the same boundary the Recommendation Center
 * itself already established. Repayment/Additional Collateral are
 * unaffected (spec §10 excludes them from `presentationTextFor` — their
 * existing copy is unchanged).
 */
import {
  calculateRecommendationActions,
  type Recommendation,
  type RecommendationItemId,
} from '@/services';
import type { Portfolio } from '@/types/portfolio';

import {
  isActionableRecommendation,
  presentationTextFor,
} from '../../recommendations/utils/recommendationTaxonomy';
import type {
  RecommendationSummary,
  RecommendationSummaryItem,
} from '../types/recommendationSummary';

/** Matches `stores/portfolioStore.ts`'s own `SOURCE_STATUS` — every portfolio is manually entered in this version (M4-014/M4-015). */
const SOURCE_STATUS = 'manual';

/** See this file's own header comment — matches `RecommendationList.tsx`'s identical `ITEM_ORDER`. */
const ITEM_ORDER: RecommendationItemId[] = ['repayment', 'additionalCollateral', 'borrow', 'loop'];

function toItem(
  id: RecommendationItemId,
  recommendation: Recommendation,
  priority: number,
): RecommendationSummaryItem {
  const presented =
    id === 'borrow' || id === 'loop' ? presentationTextFor(id, recommendation) : null;
  return {
    priority,
    category: recommendation.category,
    riskLevel: recommendation.decisionPriority,
    explanation: presented?.headline ?? recommendation.triggeringCondition,
    suggestedAction: presented?.detail ?? recommendation.suggestedAction,
    expectedEffect: recommendation.expectedEffect,
  };
}

export function buildRecommendationSummary(portfolio: Portfolio): RecommendationSummary {
  const actionsResult = calculateRecommendationActions(portfolio, SOURCE_STATUS);
  if (!actionsResult.ok) return { items: [], emptyReason: 'unavailable' };
  if (actionsResult.data.targetHealthFactor === null)
    return { items: [], emptyReason: 'no_target' };

  const items: RecommendationSummaryItem[] = [];
  for (const id of ITEM_ORDER) {
    const recommendation = actionsResult.data.items[id];
    if (recommendation === undefined) continue;
    if (!isActionableRecommendation(id, recommendation)) continue;
    items.push(toItem(id, recommendation, items.length + 1));
  }

  return { items, emptyReason: items.length === 0 ? 'target_met' : null };
}

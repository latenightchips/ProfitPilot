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
 * (Health Factor: "Prevent Liquidation"; Repayment/Additional Collateral:
 * "Maintain Target Health Factor"; Borrow/Loop: "Improve Capital
 * Efficiency"; Interest Cost: "Reduce Interest Costs"), with a stable
 * declaration-order tiebreak within a shared tier. Restated here rather
 * than imported, matching this codebase's own "each component owns its
 * own small static ordering" precedent (see e.g.
 * `UNAVAILABLE_FILTER_REASONS`'s restatement in `recommendationTaxonomy.ts`).
 *
 * **Dashboard/Recommendation-Center parity fix (post-F-026/F-060 audit)**
 * — `ITEM_ORDER` previously listed only `'repayment' | 'additionalCollateral'
 * | 'borrow' | 'loop'`, the four items that existed when v1.19.0 Batch 1
 * wrote it. `'healthFactor'` (F-060) and `'interestCost'` (F-065) were
 * added to `RecommendationItemId`/`calculateRecommendationActions` by
 * later batches without this file being revisited, so both were silently
 * omitted from the Dashboard summary despite being fully computed and
 * already shown in the Recommendation Center. `ITEM_ORDER` now lists all
 * six currently-implemented ids, in `RecommendationList.tsx`'s own
 * canonical order. No selection/ranking logic changed — this loop already
 * iterated an arbitrary-length `ITEM_ORDER` and already skipped any id
 * absent from `actionsResult.data.items`; only the array literal was
 * stale. There is no independent "show at most N" product rule anywhere
 * in `06_TASKS.md`, `03_UI.md`, or `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * — the previous "maximum item count is 4" claim in this file's own prior
 * revision was derived solely from `ITEM_ORDER`'s own length, not a
 * separately documented cap; `RecommendationSummarySection.tsx` has never
 * truncated `summary.items`.
 *
 * **Presentation-language boundary reused, not reinvented.** Borrow/Loop's
 * `explanation`/`suggestedAction` fields are sourced through
 * `presentationTextFor` (v1.18.0 Batch 4) exactly as
 * `RecommendationList.tsx`/`RecommendationDetailPanel.tsx` already do —
 * this Dashboard section never reads their raw `triggeringCondition`/
 * `suggestedAction` directly, the same boundary the Recommendation Center
 * itself already established. Repayment/Additional Collateral/Health
 * Factor/Interest Cost are unaffected (`presentationTextFor` is
 * deliberately scoped to `'borrow' | 'loop'` only — spec §10 excludes the
 * others; `RecommendationList.tsx`/`RecommendationDetailPanel.tsx` read
 * Health Factor's and Interest Cost's own raw fields directly too, the
 * same convention this file's existing `toItem` fallback already used for
 * Repayment/Additional Collateral) — their existing copy is unchanged.
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
const ITEM_ORDER: RecommendationItemId[] = [
  'healthFactor',
  'repayment',
  'additionalCollateral',
  'borrow',
  'loop',
  'interestCost',
];

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

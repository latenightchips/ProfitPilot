'use client';

import { StrategyErrorBanner } from '@/components/strategy/StrategyErrorBanner';
import {
  filterCategoryFor,
  type RecommendationSeverity,
  SEVERITY_ORDER,
  severityFor,
  UNAVAILABLE_FILTER_REASONS,
} from '@/features/recommendations/utils/recommendationTaxonomy';
import type { Recommendation } from '@/services';
import {
  type RecommendationItemId,
  useRecommendationCenterStore,
} from '@/stores/recommendationCenterStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Recommendation List — 06_TASKS.md M7-032 ("Implement Recommendation
 * List"). Display recommendations ordered by documented priority rules.
 * Group by: "Critical / High / Medium / Informational." DoD: "Ordering
 * is deterministic and consistent across sessions." Also implements the
 * Recommendation Center's own share of M7-037 ("Loading and Empty
 * States" — the `status === 'idle'` message below) and M7-038
 * ("Strategy Error Recovery" — `StrategyErrorBanner`, Milestone 7 Batch
 * 7), replacing the plain inline error paragraph this component
 * originally used.
 *
 * **Deterministic by construction, not by sorting a variable-length
 * list.** `useRecommendationCenterStore`'s own `actions` is always
 * exactly the same two-item shape when present
 * (`TargetHealthFactorActions.{repayment, additionalCollateral}`) — no
 * date, insertion order, or other non-deterministic key is ever
 * consulted. `ITEM_ORDER` fixes a stable secondary sort key (primary:
 * `SEVERITY_ORDER`) so two items that land in the same severity group
 * always render in the same relative order across sessions.
 *
 * **Acknowledged items (M7-035) are never hidden outright** — they
 * render in their own, always-visible "Acknowledged" section below the
 * active groups, satisfying "must not hide critical risk changes
 * permanently" independently of the automatic-return-on-change
 * mechanism `stores/recommendationCenterStore.ts`'s own `recalculate`
 * already implements.
 *
 * **`actions === null` while `status === 'error'` is now a real,
 * reachable state — a Batch 7 change, not the same "unreachable"
 * finding Batch 6 documented here.** `recalculate`'s own failure branch
 * now preserves `actions` when recalculating the *same* portfolio
 * (M7-038 "Restore last valid result"), so a failure only nulls
 * `actions` on the very first calculation for a portfolio, or right
 * after switching to a different, already-broken one — both genuinely
 * possible. The error banner always explains the failure in either
 * case; the list below only renders once `actions !== null`.
 */
const ITEM_ORDER: RecommendationItemId[] = ['repayment', 'additionalCollateral'];

interface ListItem {
  id: RecommendationItemId;
  recommendation: Recommendation;
  severity: RecommendationSeverity;
}

function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
    // `severityDelta !== 0` is unreachable given today's real data —
    // both `repayment` and `additionalCollateral` always carry the same
    // `decisionPriority` ('Maintain Target Health Factor', hardcoded in
    // `calculateRepaymentRecommendation`/`calculateAdditionalCollateralRecommendation`),
    // so they always land in the same severity group. Written generically
    // (primary severity key, `ITEM_ORDER` tiebreak) rather than assuming
    // that correlation, the same defense-in-depth precedent this file's
    // own other documented-unreachable branches already establish.
    const severityDelta = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDelta !== 0) return severityDelta;
    return ITEM_ORDER.indexOf(a.id) - ITEM_ORDER.indexOf(b.id);
  });
}

function RecommendationRow({ item }: { item: ListItem }) {
  const selectedItemId = useRecommendationCenterStore((state) => state.selectedItemId);
  const selectItem = useRecommendationCenterStore((state) => state.selectItem);
  const acknowledgements = useRecommendationCenterStore((state) => state.acknowledgements);
  const portfolioId = useRecommendationCenterStore((state) => state.portfolioId);
  const acknowledge = useRecommendationCenterStore((state) => state.acknowledge);
  const unacknowledge = useRecommendationCenterStore((state) => state.unacknowledge);

  const isAcknowledged =
    portfolioId !== null && acknowledgements[portfolioId]?.[item.id] !== undefined;
  const isSelected = selectedItemId === item.id;

  return (
    <li
      className={`flex flex-col gap-1.5 rounded-md border p-3 text-sm ${
        isSelected ? 'border-foreground' : 'border-border'
      }`}
    >
      <button
        type="button"
        onClick={() => selectItem(item.id)}
        className="flex flex-col items-start gap-1 text-left"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {item.severity} · {item.recommendation.decisionPriority}
        </span>
        <span className="font-medium text-foreground">
          {item.recommendation.triggeringCondition}
        </span>
        <span className="text-muted-foreground">{item.recommendation.suggestedAction}</span>
      </button>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => (isAcknowledged ? unacknowledge(item.id) : acknowledge(item.id))}
          className="self-end rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground/80 hover:bg-accent/40"
        >
          {isAcknowledged ? 'Un-acknowledge' : 'Acknowledge'}
        </button>
      </div>
    </li>
  );
}

export function RecommendationList({ portfolio }: { portfolio: Portfolio }) {
  const status = useRecommendationCenterStore((state) => state.status);
  const actions = useRecommendationCenterStore((state) => state.actions);
  const errors = useRecommendationCenterStore((state) => state.errors);
  const categoryFilter = useRecommendationCenterStore((state) => state.categoryFilter);
  const acknowledgements = useRecommendationCenterStore((state) => state.acknowledgements);
  const portfolioId = useRecommendationCenterStore((state) => state.portfolioId);

  if (status === 'idle') {
    return <p className="text-sm text-muted-foreground">Preparing recommendations…</p>;
  }

  if (status === 'noTarget') {
    return (
      <p className="text-sm text-muted-foreground">
        No target Health Factor is configured for this portfolio yet — set one in the
        portfolio&rsquo;s Settings to see debt and collateral recommendations here.
      </p>
    );
  }

  const isUnavailableCategory =
    categoryFilter !== 'all' && categoryFilter in UNAVAILABLE_FILTER_REASONS;

  const allItems: ListItem[] =
    actions === null
      ? []
      : ITEM_ORDER.map((id) => {
          const recommendation = actions[id];
          return { id, recommendation, severity: severityFor(recommendation) };
        }).filter((item) =>
          categoryFilter === 'all'
            ? true
            : filterCategoryFor(item.recommendation) === categoryFilter,
        );

  // `portfolioId !== null` is unreachable here — `recalculate` always
  // sets `portfolioId` and `status` together (every branch of that
  // action), and this line only runs once `status` is 'ready' or
  // 'error' (past the `idle`/`noTarget` early returns above), which
  // guarantees `portfolioId` is already set. Kept as a defensive guard
  // since the two fields are independent in the Store's own state type.
  const acknowledgedIds = new Set(
    portfolioId !== null ? Object.keys(acknowledgements[portfolioId] ?? {}) : [],
  );
  const activeItems = sortItems(allItems.filter((item) => !acknowledgedIds.has(item.id)));
  const acknowledgedItems = sortItems(allItems.filter((item) => acknowledgedIds.has(item.id)));

  return (
    <div className="flex flex-col gap-4">
      {status === 'error' && (
        <StrategyErrorBanner
          errors={errors}
          portfolio={portfolio}
          retryHint="Adjust your portfolio to try again."
        />
      )}

      {isUnavailableCategory && (
        <p className="text-sm text-muted-foreground">
          Not available for this category. {UNAVAILABLE_FILTER_REASONS[categoryFilter]}
        </p>
      )}

      {!isUnavailableCategory && actions !== null && (
        <>
          {/* Unreachable given the current, fixed two-item shape: a
              non-unavailable `categoryFilter` is either 'all' (2 items),
              'debt' (repayment, always present), or 'collateral'
              (additionalCollateral, always present) — never 0. Kept as
              defense in depth for a future category this Recommendation
              Center might add, the same "documented, not force-tested"
              precedent `PartialExitResult.tsx`'s own `after.liquidation
              !== null` branch already establishes. */}
          {allItems.length === 0 && (
            <p className="text-sm text-muted-foreground">No recommendations in this category.</p>
          )}

          {SEVERITY_ORDER.filter((severity) =>
            activeItems.some((item) => item.severity === severity),
          ).map((severity) => (
            <div key={severity} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {severity}
              </h3>
              <ul className="flex flex-col gap-2">
                {activeItems
                  .filter((item) => item.severity === severity)
                  .map((item) => (
                    <RecommendationRow key={item.id} item={item} />
                  ))}
              </ul>
            </div>
          ))}

          {activeItems.length === 0 && allItems.length > 0 && (
            <p className="text-sm text-muted-foreground">
              No active recommendations in this category — see Acknowledged below, if any.
            </p>
          )}

          {acknowledgedItems.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Acknowledged
              </h3>
              <ul className="flex flex-col gap-2">
                {acknowledgedItems.map((item) => (
                  <RecommendationRow key={item.id} item={item} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

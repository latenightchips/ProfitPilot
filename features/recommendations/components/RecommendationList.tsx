'use client';

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

/**
 * Recommendation List — 06_TASKS.md M7-032 ("Implement Recommendation
 * List"). Display recommendations ordered by documented priority rules.
 * Group by: "Critical / High / Medium / Informational." DoD: "Ordering
 * is deterministic and consistent across sessions."
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
 */
const ITEM_ORDER: RecommendationItemId[] = ['repayment', 'additionalCollateral'];

interface ListItem {
  id: RecommendationItemId;
  recommendation: Recommendation;
  severity: RecommendationSeverity;
}

function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
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

export function RecommendationList() {
  const status = useRecommendationCenterStore((state) => state.status);
  const actions = useRecommendationCenterStore((state) => state.actions);
  const errors = useRecommendationCenterStore((state) => state.errors);
  const categoryFilter = useRecommendationCenterStore((state) => state.categoryFilter);
  const acknowledgements = useRecommendationCenterStore((state) => state.acknowledgements);
  const portfolioId = useRecommendationCenterStore((state) => state.portfolioId);

  if (status === 'idle') {
    return null;
  }

  if (status === 'noTarget') {
    return (
      <p className="text-sm text-muted-foreground">
        No target Health Factor is configured for this portfolio yet — set one in the
        portfolio&rsquo;s Settings to see debt and collateral recommendations here.
      </p>
    );
  }

  if (status === 'error') {
    return (
      <p role="alert" className="text-sm text-destructive">
        {errors.map((error) => error.message).join(' ')}
      </p>
    );
  }

  if (categoryFilter !== 'all' && categoryFilter in UNAVAILABLE_FILTER_REASONS) {
    return (
      <p className="text-sm text-muted-foreground">
        Not available for this category. {UNAVAILABLE_FILTER_REASONS[categoryFilter]}
      </p>
    );
  }

  // Unreachable via any real call to `recalculate` — that action always
  // sets `actions` and `status: 'ready'` together in the same `set()`
  // call (`stores/recommendationCenterStore.ts`), so `status === 'ready'`
  // (already established above) guarantees `actions !== null` here. Kept
  // as a defensive type-narrowing guard, not a reachable branch — the
  // two fields are independent in `RecommendationCenterState`'s own
  // type, so TypeScript cannot infer the correlation itself.
  if (actions === null) {
    return null;
  }

  const allItems: ListItem[] = ITEM_ORDER.map((id) => {
    const recommendation = actions[id];
    return { id, recommendation, severity: severityFor(recommendation) };
  }).filter((item) =>
    categoryFilter === 'all' ? true : filterCategoryFor(item.recommendation) === categoryFilter,
  );

  const acknowledgedIds = new Set(
    portfolioId !== null ? Object.keys(acknowledgements[portfolioId] ?? {}) : [],
  );
  const activeItems = sortItems(allItems.filter((item) => !acknowledgedIds.has(item.id)));
  const acknowledgedItems = sortItems(allItems.filter((item) => acknowledgedIds.has(item.id)));

  // Unreachable given the current, fixed two-item shape: `categoryFilter`
  // is either 'all' (2 items), 'debt' (repayment, always present), or
  // 'collateral' (additionalCollateral, always present) at this point —
  // every genuinely unavailable category already returned above. Kept as
  // defense in depth for a future category this Recommendation Center
  // might add, the same "documented, not force-tested" precedent
  // `PartialExitResult.tsx`'s own `after.liquidation !== null` branch
  // already establishes.
  if (allItems.length === 0) {
    return <p className="text-sm text-muted-foreground">No recommendations in this category.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
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

      {activeItems.length === 0 && (
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
    </div>
  );
}

'use client';

import { StrategyErrorBanner } from '@/components/strategy/StrategyErrorBanner';
import {
  filterCategoryFor,
  isActionableRecommendation,
  ITEM_FILTER_CATEGORY,
  type RecommendationSeverity,
  SEVERITY_ORDER,
  severityFor,
  UNAVAILABLE_FILTER_REASONS,
} from '@/features/recommendations/utils/recommendationTaxonomy';
import type { Recommendation, RecommendationExplanationSet } from '@/services';
import {
  type RecommendationItemId,
  useRecommendationCenterStore,
} from '@/stores/recommendationCenterStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * v1.18.0 Batch 3 — `RecommendationExplanationSet` (V1.1 Batch 5) only
 * ever has `repayment`/`additionalCollateral` keys (spec §8: extending
 * Quantified Impact to Borrow/Loop is out of scope this batch), so a
 * `borrow`/`loop` id has no explanation to look up — this narrows before
 * indexing rather than widening `RecommendationExplanationSet`'s own type.
 */
function explanationFor(
  explanations: RecommendationExplanationSet | null,
  id: RecommendationItemId,
) {
  if (explanations === null) return null;
  if (id === 'repayment' || id === 'additionalCollateral') return explanations[id];
  return null;
}

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
 *
 * **v1.18.0 Batch 3** — `actions` is now `Partial<Record<...>>`
 * (`stores/recommendationCenterStore.ts`), not a fixed two-key object:
 * `borrow`/`loop` are present only when this portfolio's own
 * `recommendationPreferences` make them so (spec §5). `ITEM_ORDER`
 * extends to all four ids; an id missing from `actions` is simply
 * skipped when building `allItems` (not shown as a disabled row), and
 * its own `unavailableReasons[id]` renders as a compact, per-item line
 * instead — scoped to its own filter category (`ITEM_FILTER_CATEGORY`),
 * since `debt`/`leverage` can now be partially available (spec §8).
 */
const ITEM_ORDER: RecommendationItemId[] = ['repayment', 'additionalCollateral', 'borrow', 'loop'];

interface ListItem {
  id: RecommendationItemId;
  recommendation: Recommendation;
  severity: RecommendationSeverity;
}

function sortItems(items: ListItem[]): ListItem[] {
  return [...items].sort((a, b) => {
    // V1.1 Batch 5: `severityDelta !== 0` IS now reachable —
    // `severityFor` (`recommendationTaxonomy.ts`) demotes a non-actionable
    // "no action needed" item to `'Informational'` regardless of its
    // `decisionPriority`, so a genuinely actionable `repayment` and a
    // non-actionable `additionalCollateral` (or vice versa) land in
    // different severity groups and this comparison decides their
    // relative order. `ITEM_ORDER` remains the tiebreak for two items
    // that land in the same group (still the common case: both
    // actionable, or both not).
    const severityDelta = SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
    if (severityDelta !== 0) return severityDelta;
    return ITEM_ORDER.indexOf(a.id) - ITEM_ORDER.indexOf(b.id);
  });
}

function RecommendationRow({
  item,
  explanations,
}: {
  item: ListItem;
  explanations: RecommendationExplanationSet | null;
}) {
  const selectedItemId = useRecommendationCenterStore((state) => state.selectedItemId);
  const selectItem = useRecommendationCenterStore((state) => state.selectItem);
  const acknowledgements = useRecommendationCenterStore((state) => state.acknowledgements);
  const portfolioId = useRecommendationCenterStore((state) => state.portfolioId);
  const acknowledge = useRecommendationCenterStore((state) => state.acknowledge);
  const unacknowledge = useRecommendationCenterStore((state) => state.unacknowledge);

  const isAcknowledged =
    portfolioId !== null && acknowledgements[portfolioId]?.[item.id] !== undefined;
  const isSelected = selectedItemId === item.id;
  const confidence = explanationFor(explanations, item.id)?.confidence ?? null;

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
        <span className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>
            {item.severity} · {item.recommendation.decisionPriority}
          </span>
          {confidence !== null && <span className="normal-case">· {confidence}</span>}
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

export function RecommendationList({
  portfolio,
  explanations,
}: {
  portfolio: Portfolio;
  explanations: RecommendationExplanationSet | null;
}) {
  const status = useRecommendationCenterStore((state) => state.status);
  const actions = useRecommendationCenterStore((state) => state.actions);
  const unavailableReasons = useRecommendationCenterStore((state) => state.unavailableReasons);
  const errors = useRecommendationCenterStore((state) => state.errors);
  const categoryFilter = useRecommendationCenterStore((state) => state.categoryFilter);
  const acknowledgements = useRecommendationCenterStore((state) => state.acknowledgements);
  const portfolioId = useRecommendationCenterStore((state) => state.portfolioId);
  const targetHealthFactor = useRecommendationCenterStore((state) => state.targetHealthFactor);

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

  // v1.18.0 Batch 3 — only items actually present in `actions` (Borrow/
  // Loop are absent, not disabled, when their own preferences are
  // incomplete — spec §8's own List behavior).
  const allItems: ListItem[] =
    actions === null
      ? []
      : ITEM_ORDER.flatMap((id) => {
          const recommendation = actions[id];
          if (recommendation === undefined) return [];
          return [{ id, recommendation, severity: severityFor(id, recommendation) }];
        }).filter((item) =>
          categoryFilter === 'all'
            ? true
            : filterCategoryFor(item.recommendation) === categoryFilter,
        );

  // v1.18.0 Batch 3 — every unavailable item (Borrow/Loop, when their own
  // preferences are incomplete) whose own filter category matches the
  // current view, each with its real, sourced reason (spec §8: scoped
  // per item, not a whole-category banner, since `debt`/`leverage` can
  // now be partially available).
  const unavailableItemsForCategory =
    actions === null
      ? []
      : ITEM_ORDER.filter((id) => {
          const reason = unavailableReasons[id];
          if (reason === undefined) return false;
          return categoryFilter === 'all' || ITEM_FILTER_CATEGORY[id] === categoryFilter;
        });

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

  /**
   * V1.1 Batch 5, Section 9 — "A healthy portfolio should not receive
   * artificial recommendations merely to fill the screen." Every
   * currently-computed item (`repayment`/`additionalCollateral`) already
   * exists even when nothing needs to change (`suggestedAction: 'No ...
   * needed.'`); this banner states that plainly instead of leaving the
   * user to infer it from two individually-worded "no action" rows, and
   * names the one metric actually being watched (this portfolio's own
   * configured Target Health Factor) plus the fact that conditions can
   * change. The individual rows remain visible below (now demoted to the
   * `'Informational'` tier by `severityFor`) — this is a clarifying
   * banner, not a replacement for them.
   */
  const allHealthy =
    allItems.length > 0 &&
    allItems.every((item) => !isActionableRecommendation(item.id, item.recommendation));

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
          {/* Reachable now (v1.18.0 Batch 3), unlike before: `leverage`
              with Loop unavailable, or `debt`/`all` with every item
              acknowledged/unavailable, can legitimately have zero
              computed items. Suppressed when `unavailableItemsForCategory`
              already explains why below, so the two messages never both
              show for the same empty state. */}
          {allItems.length === 0 && unavailableItemsForCategory.length === 0 && (
            <p className="text-sm text-muted-foreground">No recommendations in this category.</p>
          )}

          {unavailableItemsForCategory.map((id) => (
            <p key={id} className="text-sm text-muted-foreground">
              {unavailableReasons[id]}
            </p>
          ))}

          {allHealthy && (
            <p role="status" className="text-sm text-foreground">
              No action needed right now — this portfolio&rsquo;s risk looks acceptable against its
              configured Target Health Factor
              {targetHealthFactor !== null ? ` (${targetHealthFactor})` : ''}. Health Factor and
              debt/collateral levels are still being watched here and will change if price, rates,
              or your position change.
            </p>
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
                    <RecommendationRow key={item.id} item={item} explanations={explanations} />
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
                  <RecommendationRow key={item.id} item={item} explanations={explanations} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

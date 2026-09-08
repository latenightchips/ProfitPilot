import Link from 'next/link';

import type { RecommendationSummary } from '../types/recommendationSummary';

/**
 * Recommendation Summary — 06_TASKS.md M5-015. DoD: "Recommendations are
 * transparent and traceable to deterministic rules." See
 * `../types/recommendationSummary.ts` for the full design reasoning
 * (why "View all" and dismiss/acknowledge behavior are not built).
 *
 * **Empty-state messaging (added Batch 9, M5-020's "No recommendations"
 * Include item)** replaces the previous "render nothing" behavior with an
 * honest, case-specific explanation — see `../types/recommendationSummary.ts`'s
 * own `emptyReason` comment for why each of the three cases reads the way
 * it does. `'target_met'` is deliberately not paired with an action link:
 * nothing is missing in that case, so forcing one would misrepresent a
 * satisfied state as a problem to fix.
 *
 * **v1.19.0 Batch 2** (Dashboard Recommendation Summary Parity, UI
 * Wiring) — this component needed **no rendering-logic change** to
 * correctly display the expanded, up-to-4-item canonical set Batch 1's
 * `buildRecommendationSummary` now produces: `summary.items.map(...)`
 * was already written generically over an arbitrary-length array, never
 * assuming exactly two, and never re-sorting — `summary.items`' own
 * order (Batch 1's `ITEM_ORDER`: Repayment, Additional Collateral,
 * Borrow, Loop) is rendered as-is. Borrow/Loop's `explanation`/
 * `suggestedAction` are already the presentation-safe strings Batch 1's
 * `presentationTextFor` integration supplies on the `RecommendationSummaryItem`
 * itself — this component reads exactly the same four fields
 * (`explanation`, `suggestedAction`, `category`, `riskLevel`,
 * `expectedEffect`) for every item regardless of which of the four
 * canonical ids produced it, deriving no financial semantics, calling no
 * formula, and reconstructing no presentation text of its own. Only this
 * file's own stale header comment (which previously said "why only
 * repayment/additional-collateral recommendations are shown," no longer
 * true) needed correcting.
 *
 * **"View all" reconsidered, still not built.** All four canonical items
 * (when present) already render in this one list with no truncation —
 * there is still no larger set behind a "View all" link to reveal, and
 * no `06_TASKS.md` task or `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md`
 * requirement calls for collapsing a 3- or 4-item list. Four short cards
 * in a vertical `flex flex-col` list is not a layout problem this
 * section's existing bordered-list shape doesn't already handle.
 *
 * **Note**: `docs/RECOMMENDATION_ENGINE_PREFERENCES_SPEC.md` §9 (written
 * during v1.18.0) documented a deliberate decision *not* to extend this
 * summary to Borrow/Loop, reasoning in part that an item could "silently
 * appear or disappear on the Dashboard with no proximate explanation of
 * why," unlike the Recommendation Center's own `unavailableReasons`
 * machinery. Batch 1/2 proceed under this batch's own explicit
 * instructions, which name empty/unavailable-state parity as
 * out-of-scope ("continue using the established Dashboard behavior
 * rather than inventing a new empty-state semantic") — that §9 concern
 * is not resolved here, and is flagged for the eventual release
 * reconciliation to address explicitly (accept the supersession, or
 * design the "why is this missing" affordance §9 anticipated).
 */
export function RecommendationSummarySection({ summary }: { summary: RecommendationSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Recommendations</h3>

      {summary.items.length > 0 ? (
        <ol className="flex flex-col gap-3">
          {summary.items.map((item) => (
            <li key={item.priority} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>Priority {item.priority}</span>
                <span>Category: {item.category}</span>
                <span>Risk level: {item.riskLevel}</span>
              </div>
              <p className="mt-1 text-sm text-foreground">{item.explanation}</p>
              <p className="text-sm text-foreground">{item.suggestedAction}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.expectedEffect}</p>
            </li>
          ))}
        </ol>
      ) : summary.emptyReason === 'no_target' ? (
        <p className="text-sm text-muted-foreground">
          No target Health Factor is configured, so no recommendations can be generated.{' '}
          <Link href="/portfolio" className="underline">
            Set a target Health Factor
          </Link>{' '}
          on the Portfolio page to see repayment and collateral recommendations here.
        </p>
      ) : summary.emptyReason === 'target_met' ? (
        <p className="text-sm text-muted-foreground">
          Your Health Factor already meets or exceeds your configured target — no action is needed
          right now.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Recommendations are currently unavailable.</p>
      )}
    </div>
  );
}

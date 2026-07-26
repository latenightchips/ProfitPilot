import Link from 'next/link';

import type { RecommendationSummary } from '../types/recommendationSummary';

/**
 * Recommendation Summary — 06_TASKS.md M5-015. DoD: "Recommendations are
 * transparent and traceable to deterministic rules." See
 * `../types/recommendationSummary.ts` for the full design reasoning
 * (why only repayment/additional-collateral recommendations are shown,
 * why "View all" and dismiss/acknowledge behavior are not built).
 *
 * **Empty-state messaging (added Batch 9, M5-020's "No recommendations"
 * Include item)** replaces the previous "render nothing" behavior with an
 * honest, case-specific explanation — see `../types/recommendationSummary.ts`'s
 * own `emptyReason` comment for why each of the three cases reads the way
 * it does. `'target_met'` is deliberately not paired with an action link:
 * nothing is missing in that case, so forcing one would misrepresent a
 * satisfied state as a problem to fix.
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

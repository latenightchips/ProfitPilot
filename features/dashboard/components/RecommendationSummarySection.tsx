import type { RecommendationSummary } from '../types/recommendationSummary';

/**
 * Recommendation Summary — 06_TASKS.md M5-015. DoD: "Recommendations are
 * transparent and traceable to deterministic rules." See
 * `../types/recommendationSummary.ts` for the full design reasoning
 * (why only repayment/additional-collateral recommendations are shown,
 * why "View all" and dismiss/acknowledge behavior are not built).
 *
 * Renders nothing when `items` is empty — legitimately the case both
 * when no target Health Factor is configured and when the configured
 * target is already met; neither warrants an error or a misleading
 * message.
 */
export function RecommendationSummarySection({ summary }: { summary: RecommendationSummary }) {
  if (summary.items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Recommendations</h3>
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
    </div>
  );
}

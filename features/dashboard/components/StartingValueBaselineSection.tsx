import Link from 'next/link';

import type { StartingValueBaselineSummary } from '../types/startingValueBaselineSummary';

/**
 * Starting-Value Baseline Section — v1.20.0 Batch 1 (Dashboard
 * Starting-Value Baseline Visibility). See
 * `../types/startingValueBaselineSummary.ts` for the full design
 * reasoning.
 *
 * **Read-only, by design.** This section renders
 * `buildStartingValueBaselineSummary`'s already-formatted output and
 * invokes no action of its own — no "Set Baseline"/"Reset Baseline"
 * control exists here. Establishing or resetting a baseline stays on
 * `app/portfolio/StartingValueBaselinePanel.tsx`; the empty state below
 * links there rather than duplicating that control on the Dashboard.
 *
 * **Terminology matches `StartingValueBaselinePanel.tsx` exactly**
 * ("Performance since [date]," "Baseline value," "Current value,"
 * "Change since baseline," "Composition changed since baseline") — the
 * canonical specification's own Decision 5 (terminology discipline) is
 * a single, portfolio-independent rule, not one convention per page.
 */
export function StartingValueBaselineSection({
  summary,
}: {
  summary: StartingValueBaselineSummary;
}) {
  if (!summary.hasBaseline) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-border p-4">
        <h3 className="text-sm font-medium text-foreground">Performance</h3>
        <p className="text-xs text-muted-foreground">
          No starting-value baseline is set for this portfolio.{' '}
          <Link href="/portfolio" className="underline">
            Set a baseline
          </Link>{' '}
          on the Portfolio page to track performance from here.
        </p>
      </div>
    );
  }

  const statusId = 'dashboard-starting-value-baseline-composition-status';

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">
        Performance since {summary.establishedAtFormatted}
      </h3>

      <dl
        className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs"
        aria-describedby={summary.compositionChanged ? statusId : undefined}
      >
        <dt className="text-muted-foreground">Baseline value</dt>
        <dd className="text-foreground">{summary.baselineValueFormatted}</dd>
        <dt className="text-muted-foreground">Current value</dt>
        <dd className="text-foreground">{summary.currentValueFormatted}</dd>
        <dt className="text-muted-foreground">Change since baseline</dt>
        <dd className="text-foreground">{summary.changeFormatted}</dd>
      </dl>

      {summary.compositionChanged && (
        <p id={statusId} className="text-xs text-muted-foreground">
          Composition changed since baseline — this comparison no longer reflects price movement
          alone.
        </p>
      )}
    </div>
  );
}

import Link from 'next/link';

import type { SafetyTargetsStatusSummary } from '../types/safetyTargetsStatusSummary';

/**
 * Safety Targets Status Section — v1.23.0 Batch 2 (Dashboard Safety
 * Targets Status Integration). See
 * `../types/safetyTargetsStatusSummary.ts` for the full design
 * reasoning.
 *
 * **Read-only, by design.** Renders
 * `buildSafetyTargetsStatusSummary`'s already-formatted output and
 * invokes no action of its own — no editing control exists here.
 * Configuring Safety Targets stays exclusively on
 * `app/portfolio/PortfolioPageClient.tsx`'s "Safety target settings"
 * fieldset, and the fuller Target/Current/Status breakdown stays on
 * `app/portfolio/SafetyTargetsStatusPanel.tsx` (v1.23.0 Batch 1) — the
 * same "no configuration surface on the Dashboard" precedent
 * `StartingValueBaselineSection.tsx` already establishes for the
 * Starting-Value Baseline, and `RecommendationSummarySection.tsx` for
 * Recommendation Preferences.
 *
 * **Always renders all four rows** — unlike `StartingValueBaselineSection`'s
 * single `hasBaseline` gate, Safety Targets have no one collapsed "not
 * configured" state; each of the four is independently optional
 * (v1.23.0 Batch 1's own rule), so a row with nothing configured simply
 * reads "Not configured" on its own, alongside three that may be fully
 * live.
 *
 * **Status is always plain text, never color alone** — matches
 * `app/portfolio/SafetyTargetsStatusPanel.tsx`'s own convention exactly
 * (this codebase's `docs/USER_GUIDE.md` "Understanding risk indicators"
 * rule: "never conveyed by color alone").
 */
export function SafetyTargetsStatusSection({ summary }: { summary: SafetyTargetsStatusSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-sm font-medium text-foreground">Safety Targets</h3>
        <Link href="/portfolio" className="text-xs text-muted-foreground underline">
          View full status on Portfolio
        </Link>
      </div>
      <ul className="flex flex-col gap-2">
        {summary.rows.map((row) => (
          <li key={row.key} className="flex flex-col gap-0.5 text-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="font-medium text-foreground">{row.label}</span>
              <span className="text-foreground">{row.statusLabel}</span>
            </div>
            <span className="text-muted-foreground">{row.detailFormatted}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

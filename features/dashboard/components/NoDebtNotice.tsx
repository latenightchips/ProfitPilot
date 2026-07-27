import Link from 'next/link';

/**
 * No-Debt Notice — 06_TASKS.md M5-020 ("Implement Dashboard Empty
 * States"), "Portfolio without debt" Include item. DoD: "Each empty
 * state explains the missing requirement and provides a clear action."
 *
 * **Additive, not a replacement.** A zero-debt portfolio already renders
 * correctly today — `PortfolioSummary.liquidation` is `null` by design
 * (Conflict #20, resolved in Milestone 4), and every affected Dashboard
 * card already shows an honest "N/A (no debt)"/"Unavailable" label
 * (`DashboardKpiGrid`, `LiquidationRiskPanel`, `HealthFactorStatusSection`).
 * What was missing was one overarching explanation — this notice adds
 * that, once, rather than duplicating it on every affected card.
 *
 * **Gated on the exact same signal every other zero-debt-aware Dashboard
 * builder already uses** (`summary.liquidation === null`,
 * `features/dashboard/utils/buildDashboardViewModel.ts`) — not a new
 * threshold or condition invented for this notice.
 *
 * **`role="status"` (Milestone 5 Batch 13, M5-024 "Complete Dashboard
 * Accessibility Pass")**: a real, found-not-assumed gap under this
 * task's own "Status announcements" Review item. `"status"`, not
 * `"alert"`, since this is informational (explaining why certain
 * metrics are unavailable), not an error or urgent warning — matching
 * the polite-vs-assertive distinction `DashboardSummaryHeader`'s own
 * storage-status line already establishes (M5-004).
 */
export function NoDebtNotice({ hasDebt }: { hasDebt: boolean }) {
  if (hasDebt) return null;

  return (
    <div role="status" className="rounded-md border border-border bg-accent/10 p-3 text-sm">
      <p className="text-foreground">
        This portfolio has no debt position — Health Factor and liquidation risk do not apply.
      </p>
      <Link href="/portfolio" className="underline">
        Add a debt position
      </Link>{' '}
      <span className="text-muted-foreground">to use leverage.</span>
    </div>
  );
}

'use client';

import Link from 'next/link';

import type { QuickActionsData } from '../types/quickActions';
import type { DashboardMetrics } from '../types/viewModel';
import {
  downloadPortfolioSummaryCsv,
  downloadPortfolioSummaryJson,
} from '../utils/exportPortfolioSummary';

/**
 * Dashboard Quick Actions section — 06_TASKS.md M5-016. DoD: "Users can
 * reach the next relevant workflow directly from the Dashboard." See
 * `../types/quickActions.ts` for the full reasoning behind which
 * actions are available/unavailable and why.
 *
 * Unavailable links render as disabled buttons carrying their reason as
 * both visible text and a `title` tooltip, matching this task's own
 * Requirement ("Unavailable actions should explain why") rather than
 * omitting them entirely — a user should be able to see that a workflow
 * exists and why it cannot be reached yet, not just that it is missing.
 */
export function QuickActionsSection({
  actions,
  portfolioId,
  portfolioName,
  calculationTimestamp,
  metrics,
}: {
  actions: QuickActionsData;
  portfolioId: string;
  portfolioName: string;
  calculationTimestamp: string;
  metrics: DashboardMetrics | null;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-4">
      <h3 className="text-sm font-medium text-foreground">Quick Actions</h3>
      <div className="flex flex-wrap gap-2">
        {actions.links.map((link) =>
          link.available ? (
            <Link
              key={link.label}
              href={link.href}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              {link.label}
            </Link>
          ) : (
            <button
              key={link.label}
              type="button"
              disabled
              title={link.unavailableReason ?? undefined}
              className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
            >
              {link.label}
            </button>
          ),
        )}
        {actions.exportAvailable && metrics !== null ? (
          <>
            <button
              type="button"
              onClick={() =>
                downloadPortfolioSummaryJson(
                  portfolioId,
                  portfolioName,
                  calculationTimestamp,
                  metrics,
                )
              }
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Export portfolio (JSON)
            </button>
            <button
              type="button"
              onClick={() =>
                downloadPortfolioSummaryCsv(
                  portfolioId,
                  portfolioName,
                  calculationTimestamp,
                  metrics,
                )
              }
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              Export portfolio (CSV)
            </button>
          </>
        ) : (
          <button
            type="button"
            disabled
            title={actions.exportUnavailableReason ?? undefined}
            className="cursor-not-allowed rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-60"
          >
            Export portfolio
          </button>
        )}
      </div>
    </div>
  );
}

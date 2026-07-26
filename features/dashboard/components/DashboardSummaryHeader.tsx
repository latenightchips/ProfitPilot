'use client';

import Link from 'next/link';

import { usePortfolioStore } from '@/stores/portfolioStore';

import type { DashboardViewModel } from '../types/viewModel';
import { formatSaveStatus } from '../utils/format';

/**
 * Dashboard Summary Header — 06_TASKS.md M5-004 ("Implement Dashboard
 * Summary Header"). Dependencies: M5-003. DoD: "The user can identify
 * which portfolio and data source are currently active."
 *
 * Renders from `DashboardViewModel`'s base fields (`portfolioId`,
 * `portfolioName`, `portfolioDescription`, `freshness`) regardless of
 * `viewModel.ok` — see `../types/viewModel.ts`'s own `DashboardViewModelBase`
 * comment for why identity/freshness never depend on the calculation
 * succeeding. Placed above the ok/error branch in `app/page.tsx`, so a
 * calculation failure still shows which portfolio and price data are
 * active, not just an error message.
 *
 * **"Portfolio switcher" — not rebuilt here.** `AppHeader` (M4-010)
 * already renders a portfolio switcher (`aria-label="Active portfolio"`)
 * globally, on every page including this one. A second, duplicate
 * switcher embedded in this section would control the exact same state
 * through a different control for no benefit — M5-004's own Include item
 * is satisfied by the one that already exists.
 *
 * **"Refresh action" — re-derives from currently-entered data, not a
 * live market fetch.** `01_PRD.md` REQ-010: "Version 0.1 uses Manual
 * Mode" — no price-provider integration exists anywhere in this codebase
 * (`services/market/quote.ts`'s own header comment describes the
 * `PriceProvider`/CoinGecko adapter as future infrastructure, never
 * built). The only honest thing "Refresh" can do in Manual Mode is
 * re-run the calculation against the portfolio's currently-entered
 * values — this button calls `recomputeSummary` (M4-017's own, already
 * real, already-shipped mechanism — the same one that task's Retry
 * button uses), rather than fabricating a live-data refresh that does
 * not exist in this application.
 *
 * **"Storage status"** reuses the exact same `saveStatus` wording
 * `app/portfolio/page.tsx`'s own `formatSaveStatus` already uses
 * (Conflict B: an in-memory Store, not a durable save) — see
 * `../utils/format.ts`.
 */
export function DashboardSummaryHeader({ viewModel }: { viewModel: DashboardViewModel }) {
  const saveStatus = usePortfolioStore((state) => state.saveStatus);
  const recomputeSummary = usePortfolioStore((state) => state.recomputeSummary);

  return (
    <div className="flex flex-col gap-2 border-b border-border pb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium text-foreground">{viewModel.portfolioName}</h2>
          {viewModel.portfolioDescription !== null && (
            <p className="text-sm text-muted-foreground">{viewModel.portfolioDescription}</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => recomputeSummary(viewModel.portfolioId)}
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            Refresh
          </button>
          <Link
            href="/portfolio"
            className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
          >
            Edit Portfolio
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span role="status">Storage: {formatSaveStatus(saveStatus)}</span>
        {viewModel.freshness.market === null ? (
          <span>BTC price unavailable</span>
        ) : (
          <span>
            BTC {viewModel.freshness.market.formattedPrice} ({viewModel.freshness.market.origin}
            {viewModel.freshness.market.freshness === 'stale' ? ', stale' : ''}) — updated{' '}
            {viewModel.freshness.market.formattedUpdatedAt}
          </span>
        )}
      </div>
    </div>
  );
}

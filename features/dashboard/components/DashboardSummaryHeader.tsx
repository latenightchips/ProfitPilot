'use client';

import Link from 'next/link';

import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
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
 * **"Refresh action" — Dashboard Live-State Cleanup batch: now actually
 * fetches live Aave V3 data, not just a local recompute.** Before this
 * batch, this button only called `recomputeSummary` (a pure, synchronous
 * re-derivation from whatever was already stored) — accurate back when
 * `01_PRD.md` REQ-010's "Manual Mode" was still true and no live-data path
 * existed at all, but stale once the Aave V3 direct-RPC integration and
 * `hooks/useAaveLiveSync.ts` shipped. Refresh now also calls
 * `useAaveLiveDataStore`'s `fetchLiveAaveData` — the already-mounted
 * `useAaveLiveSync` hook picks up the resulting quote change and applies
 * it through its own equality-gated `update()` (never touching
 * `collateral`/`debt` — see that hook's own header comment), the same
 * safe path an automatic sync uses. `recomputeSummary` is kept alongside
 * it (not replaced) so this button still recomputes immediately and
 * synchronously against whatever is currently stored, rather than only
 * after the async fetch resolves.
 *
 * **"Storage status"** reuses the exact same `saveStatus` wording
 * `app/portfolio/page.tsx`'s own `formatSaveStatus` already uses
 * (Conflict B: an in-memory Store, not a durable save) — see
 * `../utils/format.ts`.
 */
export function DashboardSummaryHeader({ viewModel }: { viewModel: DashboardViewModel }) {
  const saveStatus = usePortfolioStore((state) => state.saveStatus);
  const recomputeSummary = usePortfolioStore((state) => state.recomputeSummary);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);
  const debtAsset = usePortfolioStore(
    (state) => state.portfolios[viewModel.portfolioId]?.portfolio.debt.asset,
  );

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
            onClick={() => {
              void fetchLiveAaveData(debtAsset ?? 'USDC');
              recomputeSummary(viewModel.portfolioId);
            }}
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

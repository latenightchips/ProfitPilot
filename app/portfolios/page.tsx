'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Portfolio List Page — 06_TASKS.md M4-004 ("Implement Portfolio List
 * Page"). DoD: "Users can identify and open any saved portfolio."
 *
 * **Route, not a sidebar item**: 03_UI.md's own "APPLICATION STRUCTURE"
 * names exactly six primary pages (Dashboard, Portfolio, Simulation,
 * Loop Builder, Exit Planner, Settings) with no seventh "Portfolio List"
 * page — a genuine gap between that fixed inventory and Milestone 4's
 * multi-portfolio requirement (documented as conflict #23). Resolved
 * conservatively: this page lives at `/portfolios` (plural, distinct
 * from the existing single-portfolio `/portfolio` detail route) but is
 * **not** added to `constants/navigation.ts`/the sidebar, reached
 * instead from the portfolio switcher in `AppHeader` (M4-010) — the Top
 * Navigation location 03_UI.md already names for "Current Portfolio
 * Name."
 *
 * **"Create action"**: links to `/portfolios/new`, a minimal scaffold
 * placeholder (the same pattern Milestone 1 used for every not-yet-built
 * page) — the full guided flow is M4-005's own, later, dedicated task.
 * This batch only needs the entry point to exist and navigate correctly
 * ("Users can identify and open any saved portfolio" is this task's own
 * DoD; it says nothing about creation completing end-to-end).
 *
 * **"Select action"**: calls `select(id)` then navigates to `/portfolio`
 * — the existing single-portfolio detail route (still Milestone 1's
 * placeholder; filling in its real content is a different, unassigned
 * task, out of this batch's scope).
 *
 * **M4-016 empty states, folded into this same page** (M4-016 depends
 * only on M4-004): "No portfolios" is this page's own real empty state.
 * "No collateral"/"No debt" are genuine, reachable per-row conditions
 * under Conflict A's single-position model (`quantity`/`balance` can be
 * exactly zero — M4-008 explicitly requires supporting zero-debt
 * portfolios) and are shown as inline badges. "Missing prices"/"Missing
 * protocol parameters" are **not reachable** under the current data
 * model: `market`/`protocol` are required, Zod-validated fields
 * (M4-002) with no code path that produces a portfolio missing either —
 * documented as part of conflict #23 rather than built as dead UI for
 * an unreachable state. The one genuinely reachable per-row problem
 * state is a failed cached summary (`record.summary.ok === false`),
 * shown generically rather than guessing which specific field caused it.
 *
 * **"Storage status"**: the store tracks one *global* `saveStatus`
 * (Batch 1), not a per-portfolio value — there is no real per-record
 * persistence to differentiate yet (Conflict B). Every row shows the
 * same global value, honestly labeled.
 */
function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatHealthFactor(value: number): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export default function PortfoliosPage() {
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const loadStatus = usePortfolioStore((state) => state.loadStatus);
  const saveStatus = usePortfolioStore((state) => state.saveStatus);
  const errors = usePortfolioStore((state) => state.errors);
  const load = usePortfolioStore((state) => state.load);
  const select = usePortfolioStore((state) => state.select);
  const router = useRouter();

  useEffect(() => {
    load();
    // Only on mount — `load` is a stable store action reference.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = Object.values(portfolios).sort(
    (a, b) => new Date(b.portfolio.updatedAt).getTime() - new Date(a.portfolio.updatedAt).getTime(),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Portfolios</h1>
          <p className="text-sm text-muted-foreground">Select a saved portfolio, or create one.</p>
        </div>
        <Link
          href="/portfolios/new"
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Create Portfolio
        </Link>
      </div>

      {loadStatus === 'loading' && (
        <p className="text-sm text-muted-foreground" role="status">
          Loading portfolios…
        </p>
      )}

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {errors.map((error) => (
            <p key={error.code}>{error.message}</p>
          ))}
        </div>
      )}

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">No portfolios yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first portfolio to start tracking your leveraged Bitcoin position.
          </p>
          <Link
            href="/portfolios/new"
            className="mt-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Create Portfolio
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map(({ portfolio, summary }) => (
            <li key={portfolio.id}>
              <button
                type="button"
                onClick={() => {
                  select(portfolio.id);
                  router.push('/portfolio');
                }}
                className="flex w-full flex-col gap-1 rounded-md border border-border p-4 text-left transition-colors hover:bg-accent/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{portfolio.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDate(portfolio.updatedAt)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                  {summary.ok ? (
                    <>
                      <span>Net Equity: {formatCurrency(summary.data.netEquity)}</span>
                      <span>Health Factor: {formatHealthFactor(summary.data.healthFactor)}</span>
                      <span>Debt: {formatCurrency(summary.data.debtValue)}</span>
                    </>
                  ) : (
                    <span className="text-destructive">
                      Unable to calculate this portfolio&rsquo;s summary.
                    </span>
                  )}
                  <span>Storage: {saveStatus}</span>
                </div>
                {(portfolio.collateral.quantity === 0 || portfolio.debt.balance === 0) && (
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    {portfolio.collateral.quantity === 0 && (
                      <span className="rounded-full bg-muted px-2 py-0.5">No collateral</span>
                    )}
                    {portfolio.debt.balance === 0 && (
                      <span className="rounded-full bg-muted px-2 py-0.5">No debt</span>
                    )}
                  </div>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

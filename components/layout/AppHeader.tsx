'use client';

import Link from 'next/link';

import { usePortfolioStore } from '@/stores/portfolioStore';

/**
 * Top navigation bar — 03_UI.md page 2, "TOP NAVIGATION": "Current Portfolio
 * Name" is one of the top bar's own named display elements. 06_TASKS.md
 * M4-010 ("Implement Active Portfolio Switching"): "Allow users to change
 * the active portfolio from the application shell" — this is that shell;
 * 03_UI.md names no separate switcher location, so the switcher lives
 * exactly where 03_UI.md already names "Current Portfolio Name."
 *
 * **Requirements not satisfiable this batch (documented, not invented)**:
 * - "Preserve unsaved changes safely" — no editable/draft portfolio state
 *   exists anywhere yet (M4-006's form and M4-013's auto-save are later
 *   batches), so there is nothing to preserve. Revisit once one exists.
 * - "Retain selection after refresh" — Conflict B (approved Milestone 4
 *   plan): the store is in-memory only, no persistence before Milestone
 *   8. A refresh always loses the selection along with every portfolio.
 * - "Load calculated summary" is already satisfied structurally:
 *   `PortfolioRecord.summary` is computed and cached at create/update
 *   time (Batch 1), so selecting a portfolio never triggers a new
 *   calculation — it is already available.
 * - "Update page context" is satisfied by Zustand's own reactivity: every
 *   component reading `usePortfolioStore` re-renders when
 *   `activePortfolioId` changes, with no additional wiring needed here.
 *
 * **Archived portfolios excluded from the switcher (M4-012, added this
 * batch)**: M4-012's own text requires archiving to "Hide from active
 * lists." This switcher is exactly such a list — the active portfolio
 * store action (`select`) already can't land here on an archived
 * portfolio, since the Store's own `archive` action (M4-012) clears
 * `activePortfolioId` when the archived record was the active one.
 */
export function AppHeader() {
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const select = usePortfolioStore((state) => state.select);

  const entries = Object.values(portfolios).filter(
    ({ portfolio }) => portfolio.archivedAt === null,
  );
  const activeName =
    activePortfolioId !== null ? portfolios[activePortfolioId]?.portfolio.name : undefined;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
      <span className="text-sm font-semibold tracking-tight text-foreground">ProfitPilot</span>
      <div className="flex items-center gap-3">
        {entries.length === 0 ? (
          <Link href="/portfolios" className="text-xs text-muted-foreground hover:underline">
            No portfolios yet — create one
          </Link>
        ) : (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Active portfolio</span>
            <select
              aria-label="Active portfolio"
              className="rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground"
              value={activePortfolioId ?? ''}
              onChange={(event) => select(event.target.value === '' ? null : event.target.value)}
            >
              <option value="" disabled>
                Select a portfolio
              </option>
              {entries.map(({ portfolio }) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Link href="/portfolios" className="text-xs text-muted-foreground hover:underline">
          {activeName !== undefined ? 'Manage portfolios' : 'View portfolios'}
        </Link>
      </div>
    </header>
  );
}

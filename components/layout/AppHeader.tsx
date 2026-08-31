'use client';

import Link from 'next/link';

import { useAuthStore } from '@/stores/authStore';
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
 * **Mobile navigation toggle (V1.1 Batch 7, Section 3)**: `AppSidebar`
 * renders nothing below `md:` — this header is the only always-visible
 * mobile surface, so its own leftmost control is the toggle for
 * `MobilePrimaryNav.tsx` (rendered by `AppShell`, not here — the panel
 * needs to sit below the full header row, not inside it, so it pushes
 * page content down instead of covering it). `mobileNavOpen`/
 * `onToggleMobileNav` are owned by `AppShell` and passed down rather than
 * duplicated in local state here, since the button and the panel it
 * controls are siblings, not parent/child.
 *
 * **Header now wraps (`flex-wrap`, `min-h-14`) below `md:` (V1.1 Batch
 * 7)**: a real, empirically-confirmed overflow bug, not assumed — with
 * no active portfolio (`entries.length === 0`) and signed out, the right
 * side renders "No portfolios yet — create one" + "View portfolios" +
 * "Sign in", all `shrink-0`; combined with the new mobile nav toggle
 * button on the left, that is more content than a single fixed-height
 * `h-14` row can fit at 375px, and every item's `shrink-0` meant none of
 * it could compress — found via an actual Playwright viewport check
 * (`document.documentElement.scrollWidth > clientWidth`, 448px vs.
 * 375px), not just reading Tailwind classes, the same discipline
 * `AppShell.tsx`'s own `min-w-0` comment documents for M5-023. This
 * specific combination (no portfolio + signed out) was never checked at
 * a mobile viewport by any existing test — every `responsiveLayout.spec.ts`
 * Dashboard case creates a portfolio first. `md:h-14 md:flex-nowrap
 * md:py-0` restores the exact previous single-row desktop layout
 * unchanged; only the mobile case gains a second row instead of
 * overflowing.
 *
 * **Archived portfolios excluded from the switcher (M4-012, added this
 * batch)**: M4-012's own text requires archiving to "Hide from active
 * lists." This switcher is exactly such a list — the active portfolio
 * store action (`select`) already can't land here on an archived
 * portfolio, since the Store's own `archive` action (M4-012) clears
 * `activePortfolioId` when the archived record was the active one.
 *
 * **`<select>` width capped at `max-w-[45vw]` below `sm:` (Milestone 5
 * Batch 12, M5-023 "Implement Dashboard Responsive Layout")**: a real,
 * empirically-confirmed bug, not assumed — a long portfolio name (e.g.
 * "Responsive Layout Verification Portfolio") forced this header wider
 * than a 375px viewport with no `flex-wrap`, producing real horizontal
 * page scroll, found via an actual Playwright viewport check
 * (`document.documentElement.scrollWidth > clientWidth`), not just
 * reading Tailwind classes. This is a cross-cutting fix in a shared,
 * pre-Milestone-5 shell component (M1-006), not Dashboard-owned code —
 * but M5-023's own literal Requirement ("No horizontal page scrolling")
 * is a property of what the Dashboard route actually renders, which
 * includes this always-present header; leaving it broken would mean
 * reporting M5-023 complete while the Dashboard still visibly overflows
 * on real mobile widths. The browser truncates the `<select>`'s own
 * displayed text within the capped width — no information is hidden,
 * the full name remains in the dropdown's own option list.
 *
 * **Account indicator (Milestone 8 Batch 5, M8-020/M8-021)**: a compact
 * "Sign in" link when signed out, or the user's email plus a "Sign out"
 * button when signed in. This header's own Sign Out always retains
 * local data — the same "never causes unrequested data loss" default
 * M8-020's own DoD asks for — since there is no cloud data yet to
 * reconcile a choice against. `/settings`'s own Account section is where
 * "Sign Out and Clear Local Data" lives as a separate, explicit,
 * confirmed action (reusing `clearLocalData`, M8-048), giving the real
 * choice M8-020's "Retain or remove local cached data according to user
 * choice" asks for without making the everyday header shortcut
 * destructive by default.
 */
export function AppHeader({
  mobileNavOpen,
  onToggleMobileNav,
}: {
  mobileNavOpen: boolean;
  onToggleMobileNav: () => void;
}) {
  const portfolios = usePortfolioStore((state) => state.portfolios);
  const activePortfolioId = usePortfolioStore((state) => state.activePortfolioId);
  const select = usePortfolioStore((state) => state.select);

  const authUser = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);

  const entries = Object.values(portfolios).filter(
    ({ portfolio }) => portfolio.archivedAt === null,
  );
  const activeName =
    activePortfolioId !== null ? portfolios[activePortfolioId]?.portfolio.name : undefined;

  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 border-b border-border px-4 py-2 md:h-14 md:flex-nowrap md:py-0 md:px-6">
      <div className="flex min-w-0 shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onToggleMobileNav}
          aria-expanded={mobileNavOpen}
          aria-controls="mobile-primary-nav"
          className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground/80 hover:bg-accent hover:text-accent-foreground md:hidden"
        >
          {mobileNavOpen ? 'Close' : 'Menu'}
        </button>
        <span className="shrink-0 text-sm font-semibold tracking-tight text-foreground">
          ProfitPilot
        </span>
      </div>
      <div className="flex min-w-0 flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {entries.length === 0 ? (
          <Link
            href="/portfolios"
            className="shrink-0 text-xs text-muted-foreground hover:underline"
          >
            No portfolios yet — create one
          </Link>
        ) : (
          <label className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="sr-only">Active portfolio</span>
            <select
              aria-label="Active portfolio"
              className="min-w-0 max-w-[45vw] rounded-md border border-border bg-transparent px-2 py-1 text-xs text-foreground sm:max-w-none"
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
        <Link href="/portfolios" className="shrink-0 text-xs text-muted-foreground hover:underline">
          {activeName !== undefined ? 'Manage portfolios' : 'View portfolios'}
        </Link>
        {authUser !== null ? (
          <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
            <span className="max-w-[30vw] truncate" title={authUser.email ?? undefined}>
              {authUser.email}
            </span>
            <button type="button" onClick={() => void signOut()} className="hover:underline">
              Sign out
            </button>
          </div>
        ) : (
          <Link href="/sign-in" className="shrink-0 text-xs text-muted-foreground hover:underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}

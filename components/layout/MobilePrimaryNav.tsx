'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/constants/navigation';

/**
 * Mobile primary navigation panel — V1.1 Batch 7, Section 3. Closes a
 * previously accepted, documented gap: `AppSidebar` renders nothing below
 * the `md:` breakpoint (`hidden ... md:block`), leaving direct URL entry
 * as the only way to reach any route on a phone (Milestone 5's own
 * "Mobile navigation gap noted, not built," worked around only via
 * Dashboard Quick Actions in Milestone 9 — `tests/e2e/mobileWorkflows.spec.ts`'s
 * own header comment). This batch closes the gap itself rather than
 * adding a second workaround.
 *
 * **An inline expand/collapse panel, not an overlay drawer** — reuses
 * this codebase's own established "no modal/portal/focus-trap library
 * anywhere" constraint (`ApplyToPortfolioReview.tsx`'s own header
 * comment documents the same decision for the same reason). Rendered by
 * `AppShell` as a sibling between the header and the `<AppSidebar>` +
 * `<main>` row, so opening it pushes page content down instead of
 * overlaying it — directly satisfying Section 3's "navigation does not
 * cover page content" without any z-index/backdrop/focus-trap machinery.
 * `md:hidden` is a defensive second guard: `AppHeader`'s own toggle
 * button is already `md:hidden`, so this can only be open at a narrow
 * viewport in practice, but the class keeps the two nav landmarks
 * (`AppSidebar`'s and this one) from ever both being real, functional
 * links visible in the same layout even under an unusual resize race.
 */
export function MobilePrimaryNav({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const pathname = usePathname();

  if (!open) return null;

  return (
    <nav
      id="mobile-primary-nav"
      aria-label="Primary"
      className="flex flex-col gap-1 border-b border-border bg-card/40 p-4 md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
              isActive ? 'bg-accent text-accent-foreground' : 'text-foreground/80'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

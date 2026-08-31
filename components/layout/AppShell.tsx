'use client';

import { type ReactNode, useState } from 'react';

import { AppHeader } from '@/components/layout/AppHeader';
import { AppSidebar } from '@/components/layout/AppSidebar';
import { MobilePrimaryNav } from '@/components/layout/MobilePrimaryNav';

/**
 * Root application shell — 03_UI.md page 2, "PRIMARY LAYOUT".
 * Header + Sidebar remain constant; only the routed page content changes.
 *
 * **`<main>` carries `min-w-0` (Milestone 5 Batch 12, M5-023 "Implement
 * Dashboard Responsive Layout")**: a real, empirically-confirmed bug, not
 * assumed — a flex item's default `min-width` is `auto`, meaning it
 * refuses to shrink below its content's natural width. Without this, any
 * wide-content descendant (e.g. `PortfolioCompositionSection`'s own
 * `overflow-x-auto` table) pushes `<main>` itself wider instead of
 * scrolling internally, which widens the whole page — found via an
 * actual Playwright viewport check at 768px
 * (`document.documentElement.scrollWidth > clientWidth`), not just
 * reading Tailwind classes. `min-w-0` is the standard, well-known fix
 * that lets a flex child shrink to its container's width so its own
 * `overflow-x-auto` descendants can do the scrolling instead of the page.
 *
 * **`mobileNavOpen` lives here, not in `AppHeader` (V1.1 Batch 7)**: the
 * toggle button (`AppHeader`) and the panel it controls
 * (`MobilePrimaryNav`) are siblings in this tree, not parent/child — the
 * panel has to render between the header and the sidebar/main row so
 * opening it pushes `<main>` down instead of overlaying it (Section 3,
 * "navigation does not cover page content"). Lifting the state one level
 * to their common parent is the standard fix, and is why this component
 * is now a Client Component (`useState`) — it previously did no client
 * work of its own, only composed already-client children.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader
        mobileNavOpen={mobileNavOpen}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
      />
      <MobilePrimaryNav open={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />
      <div className="flex flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

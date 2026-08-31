'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ITEMS } from '@/constants/navigation';

/**
 * Persistent left sidebar navigation — 03_UI.md page 2, "LEFT SIDEBAR".
 * Presentation only; no business logic or data fetching.
 *
 * **`aria-current="page"` on the active route (V1.1 Batch 7, Section
 * 3 — "active route remains understandable")**: a real, previously-absent
 * gap, not assumed — this component had no `usePathname()` call and no
 * conditional styling of any kind before this batch, confirmed by reading
 * the file. Below `md:` this sidebar is entirely `hidden`;
 * `MobilePrimaryNav.tsx` applies the identical highlighting rule to the
 * same `NAV_ITEMS` for that viewport instead of duplicating this logic
 * into a shared hook, since the two only ever render on mutually
 * exclusive sides of the same breakpoint.
 */
export function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-card/40 md:block">
      <nav aria-label="Primary" className="flex flex-col gap-1 p-4">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground ${
                isActive ? 'bg-accent text-accent-foreground' : 'text-foreground/80'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

import Link from 'next/link';

import { NAV_ITEMS } from '@/constants/navigation';

/**
 * Persistent left sidebar navigation — 03_UI.md page 2, "LEFT SIDEBAR".
 * Presentation only; no business logic or data fetching.
 */
export function AppSidebar() {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-card/40 md:block">
      <nav aria-label="Primary" className="flex flex-col gap-1 p-4">
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

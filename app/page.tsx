import type { Metadata } from 'next';

import { DashboardPageClient } from './DashboardPageClient';

/**
 * Thin Server Component wrapper — 06_TASKS.md M9-024 ("Perform Screen
 * Reader Review"), Verify: "Page titles." Before this batch, every route
 * shared one static `<title>ProfitPilot</title>` (the root layout's own
 * default), so a screen-reader user's route announcer had nothing
 * distinguishing to say on navigation.
 *
 * An imperative `document.title` set from a `useEffect` inside this
 * page's own Client Component does not work in Next.js App Router —
 * confirmed empirically (console-log instrumentation showed the effect
 * ran and set the title, yet `page.title()` still reported the stale
 * value; a control test setting the title via `page.evaluate()` from
 * outside React persisted correctly, ruling out a periodic revert).
 * The real cause: Next.js's own internal metadata-sync effect lives
 * higher in the component tree, and because React commits effects
 * child-before-parent on mount, that effect always runs — and reverts —
 * *after* this page's own effect.
 *
 * The only reliable fix is this Server/Client split: a thin, non-`'use
 * client'` `page.tsx` exporting Next.js-native `metadata`, rendering a
 * Client Component with the route's entire original implementation
 * unchanged. The default export keeps the same name (`DashboardPage`)
 * every existing unit test already imports from this exact path, so no
 * test needed to change.
 */
export const metadata: Metadata = {
  title: 'Dashboard — ProfitPilot',
};

export default function DashboardPage() {
  return <DashboardPageClient />;
}

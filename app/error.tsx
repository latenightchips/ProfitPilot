'use client';

import Link from 'next/link';
import { useEffect, useMemo } from 'react';

import { generateDiagnosticId } from '@/utils/diagnosticId';

/**
 * Application Error Boundary — 06_TASKS.md M9-043 ("Audit Application
 * Error Boundaries"). Description: "Ensure unexpected component failures
 * are contained." Include: "Application-level boundary, Feature-level
 * boundaries where appropriate, Recovery actions, Diagnostic
 * identifiers, Safe user messages." DoD: "A component failure does not
 * force the entire application into an unrecoverable blank state."
 *
 * **Genuine gap, confirmed empty before this batch** — a repository-wide
 * search found no `error.tsx`/`global-error.tsx` under `app/` and no
 * React `ErrorBoundary` (class component or otherwise) anywhere. What
 * existed instead — `DashboardErrorBanner.tsx`, `StrategyErrorBanner.tsx`,
 * `RiskWarningBanner.tsx` — all catch an already-returned
 * `{ ok: false }` `ApplicationError`/`FormulaError` result, never an
 * actual thrown-during-render exception. Nothing in this codebase caught
 * a real React render crash before this file.
 *
 * **This is Next.js App Router's own file-based error boundary
 * convention** (a required Client Component exporting `{ error, reset }`
 * props), not a hand-rolled `componentDidCatch` class — it wraps every
 * route under the root layout, satisfying "Application-level boundary."
 * `AppShell` (sidebar/nav) still renders around this file, since it lives
 * in `app/layout.tsx` above where this boundary applies — a crashed page
 * still leaves the user able to navigate elsewhere, not stranded.
 *
 * **"Feature-level boundaries where appropriate" — audited, none added.**
 * This codebase's own Engine → Services → Stores → UI boundary means
 * every calculation/persistence/import/export path already returns a
 * `FormulaResult`/`MappingResult` discriminated union rather than
 * throwing (`services/shared/errors.ts`'s own DoD) — an actual
 * render-time `throw` reaching this boundary can only come from a
 * genuine programming defect (a null-shape assumption, a third-party
 * library like `recharts` choking on an edge-case prop), not an expected
 * business-logic failure, which already has its own inline banner
 * pattern. A defect like that is exactly as likely in any one feature as
 * any other — there is no single fragile subtree in this codebase that
 * uniquely justifies its own nested boundary over this one shared one,
 * and adding one speculatively would be exactly the "change merely to
 * satisfy a checklist item" this batch's own governing instruction rules
 * out. This file's own DoD ("does not force the entire application into
 * an unrecoverable blank state") is fully satisfied by the route-level
 * boundary alone: a crash on any one route leaves every other route,
 * including the sidebar navigation to reach them, intact.
 *
 * **Diagnostic identifiers**: Next's own `error.digest` is populated only
 * for errors Next.js itself hashes (primarily server-side render errors);
 * a client-render exception in this fully-client-rendered application
 * frequently leaves it `undefined`. A short `generateDiagnosticId()`
 * (`utils/diagnosticId.ts`) is generated unconditionally instead, shown
 * to the user as something to quote when reporting an issue, and logged
 * to the console alongside the real `Error` — the same "preserve
 * diagnostic context for logs" requirement M9-044 states for every other
 * error path, applied here too.
 *
 * **Safe user message**: never renders `error.message` — an uncaught
 * exception's own message is not guaranteed to be user-safe the way
 * `ApplicationError.message` is by convention (`services/shared/errors.ts`'s
 * own DoD); only a fixed, generic sentence is shown.
 *
 * **Recovery actions**: `reset()` (Next's own re-render-the-segment
 * callback — "Try again") and a link back to the Dashboard (`/`), the
 * same "return to a known-good page" pattern `DashboardErrorBanner.tsx`'s
 * own "Return to Portfolio" link already establishes for a narrower
 * failure.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const diagnosticId = useMemo(() => generateDiagnosticId(), []);

  useEffect(() => {
    console.error(`[${diagnosticId}]`, error);
  }, [error, diagnosticId]);

  return (
    <div
      role="alert"
      className="mx-auto mt-12 flex max-w-md flex-col gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-6 text-sm"
    >
      <p className="font-medium text-destructive">Something went wrong.</p>
      <p className="text-muted-foreground">
        This page ran into an unexpected error. Your saved data is stored separately and is
        unaffected.
      </p>
      <p className="text-xs text-muted-foreground">Reference code: {diagnosticId}</p>
      <div className="mt-1 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

import Link from 'next/link';

/**
 * Portfolio creation entry point — scaffold only.
 *
 * `app/portfolios/page.tsx`'s (M4-004) "Create action" needs somewhere
 * real to navigate to; the guided setup flow itself is M4-005
 * ("Implement Portfolio Creation Flow"), a separate, later, dedicated
 * task, not built here — the same placeholder-route pattern Milestone 1
 * used for every not-yet-implemented page
 * (`components/layout/PlaceholderPage.tsx`).
 */
export default function NewPortfolioPage() {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Portfolio</h1>
      <p className="text-sm text-muted-foreground">
        The guided portfolio setup flow is implemented in a later Milestone 4 batch (M4-005) — see
        PROJECT_STATUS.md.
      </p>
      <Link href="/portfolios" className="mt-2 text-sm text-foreground underline">
        Back to Portfolios
      </Link>
    </div>
  );
}

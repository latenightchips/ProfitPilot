/**
 * Top navigation bar — 03_UI.md page 2, "TOP NAVIGATION".
 * Displays global, read-only context only (logo, connection status).
 * Live BTC price / timestamp are wired up once the Formula Engine (Milestone 2)
 * and Market data source exist — see PROJECT_STATUS.md.
 */
export function AppHeader() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4 md:px-6">
      <span className="text-sm font-semibold tracking-tight text-foreground">ProfitPilot</span>
      <span className="text-xs text-muted-foreground">Manual Portfolio</span>
    </header>
  );
}

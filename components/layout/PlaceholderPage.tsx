/**
 * Shared placeholder for routes not yet implemented (Milestone 1 scaffolding only).
 * Each ProfitPilot page answers exactly one question — 03_UI.md "CORE UX PRINCIPLES".
 */
export function PlaceholderPage({ title, question }: { title: string; question: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
      <p className="text-sm text-muted-foreground">&ldquo;{question}&rdquo;</p>
      <p className="mt-4 text-sm text-muted-foreground">
        This page is scaffolded in Milestone 1. Functionality is implemented in a later milestone —
        see PROJECT_STATUS.md.
      </p>
    </div>
  );
}

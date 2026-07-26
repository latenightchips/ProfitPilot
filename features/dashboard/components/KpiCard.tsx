import type { ReactNode } from 'react';

/**
 * Shared KPI Card — 06_TASKS.md M5-005 ("Create Shared KPI Card
 * Component"). Dependencies: M1-006. DoD: "The component supports all
 * Dashboard KPI use cases without feature-specific logic."
 *
 * Purely presentational — accepts already-formatted strings and status
 * values, computes nothing (Requirements: "No financial calculations").
 * Lives under `features/dashboard/` for now since the Dashboard is its
 * only consumer so far; nothing about it is Dashboard-specific, so a
 * later milestone needing the identical card can promote it to a shared
 * location then, rather than pre-emptively generalizing a component with
 * exactly one caller today.
 *
 * **Every "Support" item is a plain, optional prop — none are wired to
 * data here, since this task's own Dependencies list only M1-006 (the
 * app layout), not any data source:**
 * - `status`: three-value (`'ok' | 'warning' | 'unavailable'`), matching
 *   this task's own literal "Support... Status" wording, even though the
 *   Dashboard's own `DashboardMetric.status` (M5-003) only ever produces
 *   `'ok'`/`'unavailable'` — `'warning'` is a real, structural capability
 *   of this generic card, simply never driven by the one caller that
 *   exists today (Conflict #1 blocks a Health-Factor-derived warning
 *   rule; see `../types/viewModel.ts`). Rendered as a text label, not
 *   color alone, matching the accessibility principle later tasks
 *   (M5-008, M5-024) make explicit.
 * - `tooltip`: uses the native `title` attribute — a minimal, always-
 *   accessible baseline; M5-024 ("Complete Dashboard Accessibility
 *   Pass") is this project's own dedicated task for a fuller
 *   tooltip-accessibility treatment, not assumed here.
 * - `trend`: optional comparison text. No historical/baseline data
 *   source exists anywhere in this application yet (no time-series
 *   storage — Conflict B, no persistence before Milestone 8), so no
 *   caller can honestly populate this yet; the prop exists so the card
 *   itself is complete per this task's own list.
 * - `developerModeDetails`: optional `ReactNode` slot. "Developer Mode"
 *   itself has no toggle or infrastructure anywhere in this codebase yet
 *   (M5-022, "Implement Dashboard Developer Mode," is the dedicated,
 *   later, still-unbuilt task for that — see `app/portfolio/page.tsx`'s
 *   own identical note on this exact gap). This card accepts the slot
 *   and renders it only if a caller passes something; gating on an
 *   "is Developer Mode enabled" flag is deliberately the caller's job,
 *   not this generic component's — there is no flag to check yet.
 * - `loading`: real prop; Dashboard's own `loadStatus === 'loading'`
 *   (M5-001) is genuine, if rarely paintable synchronously.
 */
export interface KpiCardProps {
  title: string;
  primaryValue: string;
  secondaryValue?: string;
  status?: 'ok' | 'warning' | 'unavailable';
  tooltip?: string;
  trend?: string;
  loading?: boolean;
  developerModeDetails?: ReactNode;
}

function statusLabel(status: KpiCardProps['status']): string | null {
  switch (status) {
    case 'warning':
      return 'Warning';
    case 'unavailable':
      return 'Unavailable';
    case 'ok':
    case undefined:
      return null;
  }
}

export function KpiCard({
  title,
  primaryValue,
  secondaryValue,
  status,
  tooltip,
  trend,
  loading = false,
  developerModeDetails,
}: KpiCardProps) {
  const label = statusLabel(status);

  return (
    <div
      className="flex flex-col gap-1 rounded-md border border-border p-3"
      title={tooltip}
      aria-busy={loading}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{title}</span>
        {label !== null && (
          <span
            className={
              status === 'warning'
                ? 'text-xs font-medium text-amber-600 dark:text-amber-400'
                : 'text-xs font-medium text-muted-foreground'
            }
          >
            {label}
          </span>
        )}
      </div>

      {loading ? (
        <div className="h-6 w-24 animate-pulse rounded bg-accent/40" aria-hidden="true" />
      ) : (
        <span className="text-base font-medium text-foreground">{primaryValue}</span>
      )}

      {secondaryValue !== undefined && !loading && (
        <span className="text-xs text-muted-foreground">{secondaryValue}</span>
      )}

      {trend !== undefined && !loading && (
        <span className="text-xs text-muted-foreground">{trend}</span>
      )}

      {developerModeDetails !== undefined && (
        <div className="mt-1 border-t border-border pt-1 text-xs text-muted-foreground">
          {developerModeDetails}
        </div>
      )}
    </div>
  );
}

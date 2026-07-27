'use client';

import Link from 'next/link';

import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';
import { downloadPortfolioRecoveryCopy } from '@/utils/portfolioRecoveryExport';

import type { DashboardViewModelError } from '../types/viewModel';

/**
 * Dashboard Error Banner — 06_TASKS.md M5-021 ("Implement Dashboard
 * Error Recovery"). Dependencies: M3-003, M5-001. Description: "Handle
 * Dashboard calculation, provider, and persistence errors." DoD: "Errors
 * do not leave the Dashboard blank or destroy valid state."
 *
 * **Cross-referenced every ERROR RECOVERY/ERROR HANDLING/BACKUP &
 * RECOVERY/DATA RECOVERY section across `01_PRD.md`, `03_UI.md`, and
 * `04_BUILD_GUIDE.md`**, mirroring M4-017's own investigation method
 * rather than only reading `06_TASKS.md`'s short "Include" list:
 *
 * - **"Loading failures" / "provider" errors — not reachable.**
 *   `load()` (M5-001) has no persistence layer to fail against (Conflict
 *   B), and no live price/protocol provider exists anywhere in this
 *   codebase (`services/market/quote.ts`'s own header comment) — nothing
 *   exists yet to fail in a way this banner could report. Same
 *   conclusion M4-017 already reached for the Portfolio page.
 * - **"Persistence" errors — not reachable**, for the identical reason
 *   (Conflict B, no persistence layer before Milestone 8).
 * - **"Calculation" errors — the real, reachable case**, exactly the one
 *   `buildDashboardViewModel`'s `{ ok: false }` branch already represents
 *   (confirmed via M4-017's own investigation: zero collateral with
 *   nonzero debt, collateral value equal to debt value, zero liquidation
 *   threshold with nonzero debt).
 * - **"Retry calculation" and "Retry refresh" — the same one button.**
 *   Per Batch 8's own M5-018 finding, there is no live data source to
 *   separately "refresh" from in this Manual-Mode version — both
 *   Include items resolve to `recomputeSummary`, the same action
 *   `DashboardSummaryHeader`'s own "Refresh" button already calls. This
 *   banner's own "Retry" button is a deliberate, intentional duplicate of
 *   that control — 03_UI.md's own "ERROR RECOVERY" section explicitly
 *   names a "Retry Button" as part of the error *display itself*, and
 *   `06_TASKS.md`'s M5-021 names "Retry calculation" as its own Include
 *   item — placed proximate to the error rather than requiring the user
 *   to notice a separate header control.
 * - **"Use last valid data" — already structurally guaranteed, the same
 *   finding M4-017 made for the Portfolio page, not re-derived here.**
 *   `stores/portfolioStore.ts`'s `update()`/`create()` only ever mutate
 *   *after* Zod validation succeeds — a rejected update never touches
 *   the existing, still-valid `Portfolio` record. There is no cache of
 *   a prior successful `PortfolioSummary` to "restore" (none exists —
 *   every mutation re-derives and re-caches unconditionally), but the
 *   underlying portfolio data itself is never destroyed or replaced by a
 *   calculation failure, satisfying this task's own DoD ("does not
 *   destroy valid state").
 * - **"Return to portfolio management"** — the existing link to
 *   `/portfolio`, already present since Batch 1.
 * - **"Export recovery copy where applicable"** — reuses M4-017's own
 *   `downloadPortfolioRecoveryCopy` directly; no new export utility.
 * - **"Diagnostic Information (Developer Mode)" (03_UI.md)** — not
 *   built. "Developer Mode" itself does not exist anywhere in this
 *   codebase yet (M5-022, a separate, later, still-unbuilt task) — the
 *   same gap M4-017 already found and left undone for the identical
 *   reason.
 * - **"Other [dashboard] sections remain functional whenever possible"
 *   (03_UI.md's Dashboard-specific "ERROR HANDLING" section)** — already
 *   true, not newly built: `DashboardSummaryHeader` and
 *   `DataFreshnessSection` (Batches 2 and 8) render above this banner,
 *   using only `Portfolio`-derived data that does not depend on
 *   `calculatePortfolioSummary` succeeding. Every other Dashboard
 *   section genuinely cannot render a partial result — `calculatePortfolioSummary`
 *   is one atomic calculation with no per-metric partial-success model —
 *   so "whenever possible" is honestly "the sections that do not depend
 *   on this one calculation," not an invented partial-rendering capability.
 * - **"Every error shown to the user should include... Error
 *   Identifier" (`01_PRD.md`'s generic error-display guideline)** — the
 *   one genuinely new addition beyond what the Portfolio page's own
 *   `CalculationErrorBanner` (M4-017) does: each error's own `code` is
 *   now shown, not only used as a React key.
 *
 * **`role="alert"` (Milestone 5 Batch 13, M5-024 "Complete Dashboard
 * Accessibility Pass")**: a real, found-not-assumed gap under this
 * task's own "Status announcements" Review item — without it, a screen
 * reader user not already focused near this banner when it appears
 * (e.g. after editing data into a failing state) would never be told a
 * calculation failed. Mirrors `RiskWarningBanner`'s own already-existing
 * `role="alert"` (M5-010) — the same class of condition, the same fix.
 */
export function DashboardErrorBanner({
  portfolioId,
  portfolio,
  viewModel,
}: {
  portfolioId: string;
  portfolio: Portfolio;
  viewModel: DashboardViewModelError;
}) {
  const recomputeSummary = usePortfolioStore((state) => state.recomputeSummary);

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm"
    >
      <p className="font-medium text-destructive">
        Unable to calculate a summary for {viewModel.portfolioName}.
      </p>
      {viewModel.errors.map((error) => (
        <div key={error.code} className="mt-1">
          <p className="text-destructive">{error.message}</p>
          <p className="text-xs text-muted-foreground">Error code: {error.code}</p>
        </div>
      ))}
      <p className="mt-2 text-xs text-muted-foreground">
        Your portfolio data is unchanged. The sections above remain usable.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => recomputeSummary(portfolioId)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Retry
        </button>
        <Link
          href="/portfolio"
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Return to Portfolio to fix the underlying data
        </Link>
        <button
          type="button"
          onClick={() => downloadPortfolioRecoveryCopy(portfolio)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
        >
          Download recovery copy
        </button>
      </div>
    </div>
  );
}

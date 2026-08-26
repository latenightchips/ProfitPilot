'use client';

import { useState } from 'react';

import { formatDateTime } from '@/components/strategy/format';
import { type SavedExitPlan, useExitPlannerStore } from '@/stores/exitPlannerStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Exit Plan Library — 06_TASKS.md M7-029 ("Implement Exit Plan Save
 * and Load"), the "Load" half. DoD: "Saved plans remain reproducible
 * and show when the source portfolio has changed."
 *
 * **Mirrors `LoopStrategyLibrary.tsx`'s own Load/Duplicate/Delete/
 * drift-notice pattern exactly** — same inline, per-row confirm/cancel
 * delete UX, same `driftNotice` comparison logic (a saved plan's own
 * `portfolioId`/`portfolioUpdatedAt` snapshot against the currently
 * active `Portfolio`'s own real `id`/`updatedAt`) — satisfying this
 * task's own DoD literally. No cross-plan comparison table is built
 * here — M7-029 names no such Requirement, the same "do not invent
 * scope beyond what the task asks for" discipline
 * `LoopStrategyLibrary.tsx`'s own header comment already applies.
 *
 * **Empty-state next action (M7-037 "Strategy Loading and Empty
 * States", Batch 7)** — the same fix as `LoopStrategyLibrary.tsx`'s own,
 * naming the real control (Save Plan, in this same route).
 *
 * **`driftNotice`/the Load tooltip distinguish a deleted originating
 * portfolio from a merely different active one (V4 Readiness Audit §12
 * P3-1)** — same reasoning and `portfolioNames` prop as
 * `LoopStrategyLibrary.tsx`'s own identical fix. `isCrossPortfolio`'s own
 * Load-blocking boolean is deliberately UNCHANGED by this — a deleted
 * portfolio must stay just as un-loadable as a merely-different one (see
 * `loadExitPlan`'s own doc comment); only the two cases' messaging now
 * differs, since "switch to that portfolio to load it" is actively wrong
 * advice when that portfolio no longer exists to switch to.
 */
function driftNotice(
  saved: { portfolioId: string; portfolioUpdatedAt: string },
  portfolio: Portfolio,
  portfolioNames: Record<string, string>,
): string | null {
  if (saved.portfolioId !== portfolio.id) {
    return portfolioNames[saved.portfolioId] !== undefined
      ? 'Saved against a different portfolio.'
      : 'The portfolio this was saved against no longer exists.';
  }
  if (saved.portfolioUpdatedAt !== portfolio.updatedAt) {
    return 'Portfolio has changed since this was saved.';
  }
  return null;
}

// M9-012 follow-up — a cross-portfolio plan is still shown (with the
// notice above), but Load must never enter this Store's actionable
// working state for a portfolio other than the one currently active;
// see `loadExitPlan`'s own doc comment (`stores/exitPlannerStore.ts`).
// The store itself also refuses the load — this disables the control so
// a user is never invited to try an action that silently does nothing.
// Deliberately unchanged by P3-1 — see this file's own header comment.
function isCrossPortfolio(saved: { portfolioId: string }, portfolio: Portfolio): boolean {
  return saved.portfolioId !== portfolio.id;
}

function sortByNewest(plans: SavedExitPlan[]): SavedExitPlan[] {
  return [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ExitPlanLibrary({
  portfolio,
  portfolioNames,
}: {
  portfolio: Portfolio;
  portfolioNames: Record<string, string>;
}) {
  const savedPlans = useExitPlannerStore((state) => state.savedPlans);
  const loadExitPlan = useExitPlannerStore((state) => state.loadExitPlan);
  const duplicateExitPlan = useExitPlannerStore((state) => state.duplicateExitPlan);
  const deleteExitPlan = useExitPlannerStore((state) => state.deleteExitPlan);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  if (savedPlans.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No exit plans saved yet. Configure an exit target above and use Save Plan to see it here.
      </p>
    );
  }

  const sorted = sortByNewest(savedPlans);

  function confirmDelete(id: string) {
    deleteExitPlan(id);
    setConfirmingDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((saved) => {
        const notice = driftNotice(saved, portfolio, portfolioNames);
        const crossPortfolio = isCrossPortfolio(saved, portfolio);
        const referencedPortfolioExists = portfolioNames[saved.portfolioId] !== undefined;
        return (
          <div key={saved.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {saved.name} — {formatDateTime(saved.createdAt)}
                {notice !== null && <span className="text-xs text-destructive"> — {notice}</span>}
              </span>
              <button
                type="button"
                onClick={() => loadExitPlan(saved.id, portfolio.id)}
                disabled={crossPortfolio}
                aria-disabled={crossPortfolio}
                title={
                  !crossPortfolio
                    ? undefined
                    : referencedPortfolioExists
                      ? 'Saved against a different portfolio — switch to that portfolio to load it.'
                      : 'The portfolio this was saved against no longer exists.'
                }
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => duplicateExitPlan(saved.id)}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
              >
                Duplicate
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDeleteId(saved.id)}
                className="rounded-md border border-destructive/40 px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </div>

            {confirmingDeleteId === saved.id && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p className="font-medium text-foreground">Delete &ldquo;{saved.name}&rdquo;?</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  This permanently removes this saved exit plan. This cannot be undone.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => confirmDelete(saved.id)}
                    className="rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:opacity-90"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDeleteId(null)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

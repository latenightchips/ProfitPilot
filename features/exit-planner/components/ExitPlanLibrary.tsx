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
 */
function driftNotice(
  saved: { portfolioId: string; portfolioUpdatedAt: string },
  portfolio: Portfolio,
): string | null {
  if (saved.portfolioId !== portfolio.id) return 'Saved against a different portfolio.';
  if (saved.portfolioUpdatedAt !== portfolio.updatedAt) {
    return 'Portfolio has changed since this was saved.';
  }
  return null;
}

function sortByNewest(plans: SavedExitPlan[]): SavedExitPlan[] {
  return [...plans].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function ExitPlanLibrary({ portfolio }: { portfolio: Portfolio }) {
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
        const notice = driftNotice(saved, portfolio);
        return (
          <div key={saved.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {saved.name} — {formatDateTime(saved.createdAt)}
                {notice !== null && <span className="text-xs text-destructive"> — {notice}</span>}
              </span>
              <button
                type="button"
                onClick={() => loadExitPlan(saved.id)}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
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

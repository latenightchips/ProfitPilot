'use client';

import { useState } from 'react';

import { formatDateTime } from '@/components/strategy/format';
import { type SavedLoopStrategy, useLoopBuilderStore } from '@/stores/loopBuilderStore';
import type { Portfolio } from '@/types/portfolio';

/**
 * Loop Strategy Library — 06_TASKS.md M7-017 ("Implement Loop Strategy
 * Save/Load"), the "Load" half — `SaveLoopStrategyForm.tsx` in this same
 * batch is the "Save" half. Store: "Saved strategies, Assumptions."
 * Description: "Allow users to save and reopen strategies."
 *
 * **Mirrors `ScenarioComparison.tsx`'s own Load/Duplicate/Delete
 * pattern** (`features/simulation/components/ScenarioComparison.tsx`,
 * M6-016/M6-017/M6-018) — same inline, per-row confirm/cancel delete UX
 * (DoD "Deletion cannot occur accidentally"), same `driftNotice`
 * comparison logic (a saved strategy's own `portfolioId`/
 * `portfolioUpdatedAt` snapshot against the currently active
 * `Portfolio`'s own real `id`/`updatedAt`). No comparison-selection
 * table is built here — unlike M6-010's own explicit "Compare multiple
 * scenarios side-by-side" task, M7-017 names no cross-strategy
 * comparison Requirement of its own; building one would be inventing
 * scope beyond what this task asks for.
 *
 * **"Assumptions" (this task's own second named Store item) is
 * satisfied by Load, not a separate display here** — loading a saved
 * strategy restores its own `settings`/`result` directly onto the
 * Store, which the already-shared `StrategyAssumptionsPanel` (M7-005)
 * then renders from, the same "do not store what is already derivable"
 * reasoning `stores/loopBuilderStore.ts`'s own header comment documents.
 *
 * **Empty-state next action (M7-037 "Strategy Loading and Empty
 * States", Batch 7)**: the bare "No strategies saved yet." left the
 * task's own DoD ("provides a clear next action") unmet — a first-time
 * user had no indication of what to do about it. Now names the real
 * control that gets a strategy here (Save Strategy, in this same route).
 *
 * **`driftNotice` distinguishes a deleted originating portfolio from a
 * merely different active one (V4 Readiness Audit §12 P3-1)** — a saved
 * strategy's own `portfolioId` snapshot can reference a portfolio that
 * still exists (just not the one currently open) or one that has since
 * been deleted entirely; `savedStrategies` is never pruned when a
 * portfolio is deleted, and the two cases warrant different user
 * expectations (switch portfolios vs. this reference is permanently
 * gone). `portfolioNames` — an `{ id: name }` map built by
 * `LoopBuilderPageClient.tsx` from the full `usePortfolioStore`
 * dictionary, the same "page composes across Stores, feature components
 * receive plain props" convention `ScenarioComparison.tsx`'s own
 * identically-shaped prop already established — is how membership is
 * checked; this component still never imports `usePortfolioStore`
 * itself. Calculation results/warnings/metadata are never touched by
 * this distinction — display only.
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

function sortByNewest(strategies: SavedLoopStrategy[]): SavedLoopStrategy[] {
  return [...strategies].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function LoopStrategyLibrary({
  portfolio,
  portfolioNames,
}: {
  portfolio: Portfolio;
  portfolioNames: Record<string, string>;
}) {
  const savedStrategies = useLoopBuilderStore((state) => state.savedStrategies);
  const loadStrategy = useLoopBuilderStore((state) => state.loadStrategy);
  const duplicateStrategy = useLoopBuilderStore((state) => state.duplicateStrategy);
  const deleteStrategy = useLoopBuilderStore((state) => state.deleteStrategy);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  if (savedStrategies.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No strategies saved yet. Configure a strategy above and use Save Strategy to see it here.
      </p>
    );
  }

  const sorted = sortByNewest(savedStrategies);

  function confirmDelete(id: string) {
    deleteStrategy(id);
    setConfirmingDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-1">
      {sorted.map((saved) => {
        const notice = driftNotice(saved, portfolio, portfolioNames);
        return (
          <div key={saved.id} className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex-1">
                {saved.name} — {formatDateTime(saved.createdAt)}
                {notice !== null && <span className="text-xs text-destructive"> — {notice}</span>}
              </span>
              <button
                type="button"
                onClick={() => loadStrategy(saved.id)}
                className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
              >
                Load
              </button>
              <button
                type="button"
                onClick={() => duplicateStrategy(saved.id)}
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
                  This permanently removes this saved strategy. This cannot be undone.
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

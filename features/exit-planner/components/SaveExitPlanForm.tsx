'use client';

import { useState } from 'react';

import { useExitPlannerStore } from '@/stores/exitPlannerStore';

/**
 * Save Exit Plan Form — 06_TASKS.md M7-029 ("Implement Exit Plan Save
 * and Load"), the "Save" half — `ExitPlanLibrary.tsx` in this same
 * batch is the "Load" half. Store: "Name, Portfolio reference, Exit
 * type, Targets, Results, Assumptions, Warnings, Timestamp, Engine and
 * Formula versions." Description: "Allow users to save and reopen exit
 * plans."
 *
 * **Mirrors `SaveLoopStrategyForm.tsx` (M7-017) exactly** — single
 * required "Name" field; "Timestamp"/"Portfolio reference" are not form
 * fields (`saveExitPlan` stamps `createdAt` itself, and
 * `portfolioId`/`portfolioUpdatedAt` come from the already-active
 * portfolio, passed in as props by `app/exit-planner/page.tsx`); "Exit
 * type"/"Targets"/"Results"/"Warnings"/"Engine and Formula versions" are
 * all captured internally by `saveExitPlan` from the Store's own
 * current state, not re-entered here. "Assumptions" is reconstructable
 * from the saved `exitType`/`targetInputs`/`portfolioId` at load time
 * via the shared `StrategyAssumptionsPanel` — see
 * `stores/exitPlannerStore.ts`'s own header comment.
 */
export function SaveExitPlanForm({
  portfolioId,
  portfolioUpdatedAt,
}: {
  portfolioId: string;
  portfolioUpdatedAt: string;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const currentResult = useExitPlannerStore((state) => state.currentResult);
  const saveExitPlan = useExitPlannerStore((state) => state.saveExitPlan);

  if (currentResult === null) {
    return <p className="text-sm text-muted-foreground">Configure an exit plan to save it.</p>;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavedId(null);

    if (name.trim() === '') {
      setError('Name is required.');
      return;
    }
    setError(null);

    const id = saveExitPlan({ name: name.trim(), portfolioId, portfolioUpdatedAt });
    if (id === null) return;

    setSavedId(id);
    setName('');
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <label className="flex flex-col gap-1 text-sm">
        <span>Name</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {error && (
        <span role="alert" className="text-xs text-destructive">
          {error}
        </span>
      )}

      <button
        type="submit"
        className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Save Plan
      </button>
      {savedId !== null && (
        <span role="status" className="text-xs text-muted-foreground">
          Saved.
        </span>
      )}
    </form>
  );
}

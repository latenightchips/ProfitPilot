'use client';

import { useState } from 'react';

import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Save Loop Strategy Form — 06_TASKS.md M7-017 ("Implement Loop Strategy
 * Save/Load"). Dependencies: M7-007. Names no `Requirements` section,
 * the same as M6-015/M6-016 (its own closest Simulation precedent).
 * Store: "Saved strategies, Assumptions." Description: "Allow users to
 * save and reopen strategies."
 *
 * **Mirrors `SaveSimulationForm.tsx` (M6-015), adjusted for what
 * M7-017's own Store list actually names.** Unlike M6-015's own literal
 * "Include: Name, Description, Timestamp, Portfolio reference" list,
 * M7-017 names no Description field at all — only "Saved strategies,
 * Assumptions" — so this form has a single "Name" input, not a second
 * optional Description field. "Timestamp"/"Portfolio reference" are not
 * form fields here either, the same reasoning as `SaveSimulationForm.tsx`:
 * `saveStrategy` (`stores/loopBuilderStore.ts`) stamps `createdAt`
 * itself, and `portfolioId`/`portfolioUpdatedAt` come from the
 * already-active portfolio, passed in as props by `app/loop-builder/page.tsx`.
 *
 * Name is required (inline-validated, the same convention every other
 * Loop Builder form field already uses). On success the form clears
 * itself and shows a brief `role="status"` confirmation; `role="alert"`
 * for the blocking "Name is required." error — the same
 * assertive/polite split `SaveSimulationForm.tsx` already established.
 */
export function SaveLoopStrategyForm({
  portfolioId,
  portfolioUpdatedAt,
}: {
  portfolioId: string;
  portfolioUpdatedAt: string;
}) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const saveStrategy = useLoopBuilderStore((state) => state.saveStrategy);

  if (currentResult === null) {
    return <p className="text-sm text-muted-foreground">Configure a strategy to save it.</p>;
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavedId(null);

    if (name.trim() === '') {
      setError('Name is required.');
      return;
    }
    setError(null);

    const id = saveStrategy({ name: name.trim(), portfolioId, portfolioUpdatedAt });
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
        Save Strategy
      </button>
      {savedId !== null && (
        <span role="status" className="text-xs text-muted-foreground">
          Saved.
        </span>
      )}
    </form>
  );
}

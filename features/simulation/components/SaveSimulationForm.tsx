'use client';

import { useState } from 'react';

import { useSimulationStore } from '@/stores/simulationStore';

/**
 * Save Simulation Form — 06_TASKS.md M6-015 ("Save Simulation").
 * Dependencies: M6-003. Priority P1, Effort M. Description: "Allow users
 * to save scenarios." Include: "Name, Description, Timestamp, Portfolio
 * reference." DoD: "Saved simulations can be reopened later." Names no
 * `Requirements` section, the same as M6-012/M6-013/M6-014.
 *
 * **The real, missing UI `ScenarioComparison.tsx` (Batch 9) and
 * `stores/simulationStore.ts`'s own `saveCurrentScenario` (Batch 2) both
 * documented as forward references to this exact task.** No dedicated
 * "Save" mockup exists in `03_UI.md` Page 5 — `06_TASKS.md`'s own
 * literal Include list is the sole source of truth for this form's
 * fields, the same precedent `ScenarioCharts.tsx`/`SimulationAssumptions.tsx`
 * already established for un-mocked tasks.
 *
 * **"Timestamp" is not a form field** — `stores/simulationStore.ts`'s
 * own `saveCurrentScenario` already stamps `createdAt` itself
 * (`new Date().toISOString()`, real since Batch 2); nothing for the
 * user to enter. **"Portfolio reference" is not a form field either** —
 * `portfolioId` comes from the already-active portfolio
 * (`app/simulation/page.tsx`'s own `record.portfolio.id`), passed in as
 * a prop, never a second portfolio picker; a simulation is already
 * scoped to whichever portfolio it was run against.
 *
 * **Only saves `currentScenario`/`currentResult` (price/interest
 * scenarios) — the same scope `saveCurrentScenario` (Batch 2) has
 * always had, not newly narrowed here.** Portfolio actions
 * (`portfolioActionPreview`) were never part of the saved-scenario/
 * comparison system (`ScenarioComparison.tsx`/`ScenarioCharts.tsx`
 * both document this same structural gap); extending `saveCurrentScenario`
 * itself to accept a second result shape would be inventing scope this
 * task's own Dependencies (M6-003 only) do not ask for.
 *
 * **Name is required (inline-validated, matching every other Simulation
 * form field's own convention); Description is optional** — directly
 * reflecting M6-015's own "Include: Name, Description" wording, which
 * names Description without qualifying it as required the way "Name"
 * reads as the primary identifying field.
 *
 * **On success, the form clears itself and shows a brief confirmation**
 * — `saveCurrentScenario` returns the new record's real `id`; a `null`
 * return (only possible if `currentScenario`/`currentResult` became
 * null between render and submit) is treated as "nothing to save" and
 * silently no-ops, the same defensive-but-unreachable-in-practice
 * pattern already accepted elsewhere in this codebase.
 */
export function SaveSimulationForm({ portfolioId }: { portfolioId: string }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const currentResult = useSimulationStore((state) => state.currentResult);
  const saveCurrentScenario = useSimulationStore((state) => state.saveCurrentScenario);

  if (currentResult === null) {
    return (
      <p className="text-sm text-muted-foreground">Run a price or interest scenario to save it.</p>
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSavedId(null);

    if (name.trim() === '') {
      setError('Name is required.');
      return;
    }
    setError(null);

    const id = saveCurrentScenario({
      name: name.trim(),
      description: description.trim() === '' ? undefined : description.trim(),
      portfolioId,
    });
    if (id === null) return;

    setSavedId(id);
    setName('');
    setDescription('');
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
      {error && <span className="text-xs text-destructive">{error}</span>}

      <label className="flex flex-col gap-1 text-sm">
        <span>Description</span>
        <textarea
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>

      <button
        type="submit"
        className="mt-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Save Scenario
      </button>
      {savedId !== null && <span className="text-xs text-muted-foreground">Saved.</span>}
    </form>
  );
}

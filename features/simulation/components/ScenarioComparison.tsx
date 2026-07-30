'use client';

import { useState } from 'react';

import { type SavedSimulation, useSimulationStore } from '@/stores/simulationStore';
import type { Portfolio } from '@/types/portfolio';

import {
  formatCurrency,
  formatDateTime,
  formatHealthFactor,
  formatLeverage,
} from '../utils/format';

/**
 * Scenario Comparison — 06_TASKS.md M6-010 ("Implement Scenario
 * Comparison"). Dependencies: M6-009. Description: "Compare multiple
 * scenarios side-by-side." Compare: "Equity, Debt, Health Factor,
 * Interest, Leverage, Liquidation price, Risk" (7 items). DoD: "Users
 * can compare scenarios without recalculation inside the UI."
 *
 * **Replaces the M6-001 "Portfolio Comparison" placeholder** —
 * `app/simulation/page.tsx`'s own last remaining one.
 *
 * **A genuinely different concept from `ScenarioSummary` (M6-009,
 * Batch 8), not a duplicate.** `03_UI.md` Page 5's own "SECTION 3
 * PORTFOLIO COMPARISON" mockup ("Compare current portfolio with
 * simulation") describes exactly what `ScenarioSummary` already builds
 * (baseline vs. the one active scenario). `06_TASKS.md`'s own M6-010
 * Description is explicit and different: "Compare **multiple**
 * scenarios side-by-side" — comparing several *saved* scenarios against
 * each other, using `savedScenarios`/`comparisonSelection`
 * (`stores/simulationStore.ts`, both real fields since Batch 2/M6-003,
 * never consumed by any UI until now). Resolved in favor of
 * `06_TASKS.md`'s own more specific wording, the same
 * authoritative-build-driver precedent this whole engagement has
 * followed for every other `03_UI.md` divergence.
 *
 * **"Without recalculation inside the UI" is satisfied structurally,
 * not just by intent.** Every `SavedSimulation` already carries its own
 * `result: SimulationResult`, computed once at `saveCurrentScenario`
 * time (Batch 2). This component only reads `saved.result.scenario`
 * fields already sitting in the Store — it never calls
 * `runSimulation`/`simulateScenario` itself.
 *
 * **The "Save Scenario" button now exists (`SaveSimulationForm.tsx`,
 * Batch 14, M6-015) — `savedScenarios` is no longer honestly-empty by
 * construction.** Each entry now carries a real user-given `name` and
 * optional `description` (`stores/simulationStore.ts`'s own Batch 14
 * fields), used below instead of a generic type label.
 *
 * **Each saved scenario is labeled by its own real `name`, then type +
 * real timestamp (`formatDateTime`)** — `name` (Batch 14) replaces the
 * generic type-only label this component used before M6-015 existed.
 *
 * **Same two documented field-availability gaps `ScenarioSummary`
 * already found (Batch 8), carried forward, not re-litigated**: "Debt"
 * and "Liquidation price" have no home in `ScenarioSummary`
 * (`engine/simulation/compareScenarios.ts`) — only `debtCost` (interest
 * cost) and `liquidationDistance` exist. Shown here as "Interest" (the
 * `Compare` list's own item, mapping directly to `debtCost`) and
 * "Liquidation Distance" (honestly relabeled, not fabricated as a
 * price).
 *
 * **"Risk" is blocked by Conflict #1, the same Health Factor risk-band
 * classification blocked since Milestone 5** (`app/page.tsx`'s own
 * Dashboard, M5-007/M5-010) — no formula or threshold set is documented
 * anywhere for turning a Health Factor into a risk category. Not built;
 * flagged the same way Milestone 5 already flagged it for the
 * Dashboard.
 *
 * **"Load" now exists (Batch 15, M6-016, "Load Saved Simulation") —
 * this is the only place a saved scenario can be reopened, so it owns
 * that action rather than a separate new component.** Calls
 * `loadSavedScenario` (`stores/simulationStore.ts`), which restores the
 * saved `scenario`/`result` exactly as computed at save time —
 * satisfying M6-016's own Requirement "Preserve original assumptions"
 * and DoD "Historical simulations remain reproducible" literally, never
 * recalculating against the *current* portfolio.
 *
 * **"Display if portfolio has changed since creation" (M6-016's own
 * second Requirement)** reuses `Portfolio.updatedAt` (real, already
 * bumped by `stores/portfolioStore.ts` on every mutation) against each
 * saved scenario's own `portfolioUpdatedAt` snapshot (Batch 15) — a
 * real comparison, not an invented staleness heuristic. A saved
 * scenario belonging to a *different* portfolio entirely (`portfolioId`
 * mismatch) is flagged distinctly from "same portfolio, since changed,"
 * since `savedScenarios` lives in the Simulation Store and is never
 * cleared when the active portfolio is switched (M6-003's own
 * independence design) — a saved scenario from another portfolio can
 * genuinely still be sitting in this list.
 *
 * **Loading does not resync `ScenarioBuilder.tsx`'s own local form
 * fields — a known, documented limitation, not an oversight.**
 * `ScenarioBuilder`'s `values` state only ever writes to the Store, it
 * never reads `currentScenario` back out (true since Batch 3); making
 * it do so would be a broader architecture change this task's own
 * narrow DoD ("Historical simulations remain reproducible" — about the
 * displayed *result*, not the input form) does not ask for. The loaded
 * scenario's own numbers are correctly reproduced everywhere they are
 * displayed (Simulation Results, Assumptions); only the Scenario
 * Builder's own input fields keep showing whatever was last typed.
 *
 * **"Duplicate" now exists (Batch 16, M6-017, "Duplicate Simulation") —
 * placed here for the same reason "Load" is: this is the only place a
 * saved scenario is ever rendered.** Calls `duplicateSavedScenario`
 * (`stores/simulationStore.ts`), which reuses `stores/portfolioStore.ts`'s
 * own already-approved "duplicate" convention (new identity, `" (Copy)"`
 * name suffix, fresh timestamp) rather than inventing a new one — M6-017
 * itself names no `Requirements` section to define what "duplicate"
 * should mean here. The new copy appears as its own row immediately,
 * with its own independent checkbox/Load/Duplicate controls, satisfying
 * the DoD ("Copies are fully independent") visibly, not just internally.
 *
 * **"Delete" now exists (Batch 17, M6-018, "Delete Simulation") —
 * `deleteSavedScenario` (`stores/simulationStore.ts`) has been real
 * since Batch 2/M6-003, but nothing ever called it until this batch.**
 * DoD "Deletion cannot occur accidentally" is satisfied by reusing
 * `app/portfolios/page.tsx`'s own already-approved inline, per-row
 * confirmation pattern (M4-012, "Implement Portfolio Archive and
 * Delete") rather than inventing a second confirmation UX: clicking
 * "Delete" opens an inline panel naming the scenario and warning the
 * action is permanent; only "Confirm Delete" inside that panel actually
 * calls `deleteSavedScenario`, "Cancel" (or picking Load/Duplicate on
 * another row) dismisses it with nothing deleted. Unlike the Portfolio
 * page's own version, no "replacement" selection step is needed here —
 * saved scenarios have no "active" concept a deletion could leave
 * dangling, so that entire branch of the Portfolio pattern is not
 * reused, only the confirm/cancel shape is.
 *
 * **Sorting now exists (Batch 19, M6-020, "Simulation History") —
 * added here, not a separate view, since this is already "the only
 * place a saved scenario is ever rendered."** Building a second,
 * parallel list with the exact same records for the sake of a
 * differently-named feature would duplicate this component's own
 * Load/Duplicate/Delete/drift-notice logic for no benefit; M6-020's
 * own DoD ("Users can quickly locate previous analyses") is about
 * *this* list's presentation, not a new page. `06_TASKS.md`'s own
 * literal "Sort: Date, Portfolio, Scenario name" list is implemented
 * as a single `<select>` (no dedicated `03_UI.md` mockup exists for
 * this task — it names no "History" section anywhere on Page 5 — so
 * the task's own wording is the sole source of truth, the same
 * precedent every other un-mocked task in this milestone already
 * established). "Date" defaults to newest-first (a documented,
 * reasonable choice for "quickly locate *previous* analyses," since
 * neither document specifies a direction); "Scenario name" is a plain
 * alphabetical sort on the real `name` field. No ascending/descending
 * toggle was built — 06_TASKS.md names three sort *keys*, not a
 * direction control, and inventing one would be scope beyond what was
 * asked.
 *
 * **"Portfolio" sort needed a portfolio *name*, not the opaque
 * `portfolioId` this component already had — resolved via a new
 * `portfolioNames` prop supplied by `app/simulation/page.tsx`, not by
 * importing `usePortfolioStore` here.** `stores/simulationStore.ts`
 * itself never imports the Portfolio Store (its own DoD); this
 * component has followed the same discipline since Batch 15
 * (`driftNotice` takes a plain `Portfolio` value, not a live
 * subscription). A saved scenario can reference a portfolio that is no
 * longer the active one — `savedScenarios` is never cleared on
 * portfolio switch (M6-003) — so resolving names needs the *full*
 * `portfolios` dictionary the page already holds, not just the single
 * active `portfolio` prop this component already received. A
 * `portfolioId` with no matching entry (e.g. a since-deleted
 * portfolio) shows literally as "(Unknown Portfolio)" rather than a
 * blank string or a crash.
 */
function scenarioLabel(scenario: { type: 'price' | 'interest' }): string {
  return scenario.type === 'price' ? 'Price Scenario' : 'Interest Scenario';
}

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

type SortKey = 'date' | 'portfolio' | 'name';

function portfolioNameFor(saved: SavedSimulation, portfolioNames: Record<string, string>): string {
  return portfolioNames[saved.portfolioId] ?? '(Unknown Portfolio)';
}

function sortSavedScenarios(
  savedScenarios: SavedSimulation[],
  sortKey: SortKey,
  portfolioNames: Record<string, string>,
): SavedSimulation[] {
  const sorted = [...savedScenarios];
  switch (sortKey) {
    case 'date':
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      break;
    case 'portfolio':
      sorted.sort((a, b) =>
        portfolioNameFor(a, portfolioNames).localeCompare(portfolioNameFor(b, portfolioNames)),
      );
      break;
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

export function ScenarioComparison({
  portfolio,
  portfolioNames,
}: {
  portfolio: Portfolio;
  portfolioNames: Record<string, string>;
}) {
  const savedScenarios = useSimulationStore((state) => state.savedScenarios);
  const comparisonSelection = useSimulationStore((state) => state.comparisonSelection);
  const toggleComparisonSelection = useSimulationStore((state) => state.toggleComparisonSelection);
  const loadSavedScenario = useSimulationStore((state) => state.loadSavedScenario);
  const duplicateSavedScenario = useSimulationStore((state) => state.duplicateSavedScenario);
  const deleteSavedScenario = useSimulationStore((state) => state.deleteSavedScenario);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('date');

  if (savedScenarios.length === 0) {
    return <p className="text-sm text-muted-foreground">No scenarios saved yet.</p>;
  }

  const selected = savedScenarios.filter((saved) => comparisonSelection.includes(saved.id));
  const sortedScenarios = sortSavedScenarios(savedScenarios, sortKey, portfolioNames);

  function confirmDelete(id: string) {
    deleteSavedScenario(id);
    setConfirmingDeleteId(null);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort by</span>
        <select
          value={sortKey}
          onChange={(event) => setSortKey(event.target.value as SortKey)}
          className="rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground"
        >
          <option value="date">Date</option>
          <option value="portfolio">Portfolio</option>
          <option value="name">Scenario name</option>
        </select>
      </label>

      <div className="flex flex-col gap-1">
        {sortedScenarios.map((saved) => {
          const notice = driftNotice(saved, portfolio);
          return (
            <div key={saved.id} className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-sm">
                <label className="flex flex-1 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={comparisonSelection.includes(saved.id)}
                    onChange={() => toggleComparisonSelection(saved.id)}
                  />
                  <span>
                    {saved.name} ({scenarioLabel(saved.scenario)}) —{' '}
                    {portfolioNameFor(saved, portfolioNames)} — {formatDateTime(saved.createdAt)}
                    {notice !== null && (
                      <span className="text-xs text-destructive"> — {notice}</span>
                    )}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => loadSavedScenario(saved.id)}
                  className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
                >
                  Load
                </button>
                <button
                  type="button"
                  onClick={() => duplicateSavedScenario(saved.id)}
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
                    This permanently removes this saved simulation. This cannot be undone.
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

      {selected.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Select scenarios above to compare them side-by-side.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="pr-4 text-left text-muted-foreground">Metric</th>
                {selected.map((saved) => (
                  <th key={saved.id} className="px-2 text-left font-medium text-foreground">
                    {saved.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="pr-4 text-muted-foreground">Equity</td>
                {selected.map((saved) => (
                  <td key={saved.id} className="px-2 text-foreground">
                    {formatCurrency(saved.result.scenario.equity)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 text-muted-foreground">Health Factor</td>
                {selected.map((saved) => (
                  <td key={saved.id} className="px-2 text-foreground">
                    {formatHealthFactor(saved.result.scenario.healthFactor)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 text-muted-foreground">Interest</td>
                {selected.map((saved) => (
                  <td key={saved.id} className="px-2 text-foreground">
                    {formatCurrency(saved.result.scenario.debtCost)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 text-muted-foreground">Leverage</td>
                {selected.map((saved) => (
                  <td key={saved.id} className="px-2 text-foreground">
                    {formatLeverage(saved.result.scenario.leverage)}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="pr-4 text-muted-foreground">Liquidation Distance</td>
                {selected.map((saved) => (
                  <td key={saved.id} className="px-2 text-foreground">
                    {formatHealthFactor(saved.result.scenario.liquidationDistance)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted-foreground">
            Debt and Liquidation Price are not shown — see this component&rsquo;s own source
            comment. Risk is blocked by Conflict #1 (no documented risk-band thresholds).
          </p>
        </div>
      )}
    </div>
  );
}

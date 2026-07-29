'use client';

import { useSimulationStore } from '@/stores/simulationStore';

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
 */
function scenarioLabel(scenario: { type: 'price' | 'interest' }): string {
  return scenario.type === 'price' ? 'Price Scenario' : 'Interest Scenario';
}

export function ScenarioComparison() {
  const savedScenarios = useSimulationStore((state) => state.savedScenarios);
  const comparisonSelection = useSimulationStore((state) => state.comparisonSelection);
  const toggleComparisonSelection = useSimulationStore((state) => state.toggleComparisonSelection);

  if (savedScenarios.length === 0) {
    return <p className="text-sm text-muted-foreground">No scenarios saved yet.</p>;
  }

  const selected = savedScenarios.filter((saved) => comparisonSelection.includes(saved.id));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        {savedScenarios.map((saved) => (
          <label key={saved.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={comparisonSelection.includes(saved.id)}
              onChange={() => toggleComparisonSelection(saved.id)}
            />
            <span>
              {saved.name} ({scenarioLabel(saved.scenario)}) — {formatDateTime(saved.createdAt)}
            </span>
          </label>
        ))}
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

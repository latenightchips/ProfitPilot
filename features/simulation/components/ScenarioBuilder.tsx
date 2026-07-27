'use client';

import { useState } from 'react';

import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import {
  type HoldingPeriod,
  PRICE_PRESETS,
  type ScenarioBuilderFormValues,
} from '../types/scenarioBuilder';
import { validateScenarioBuilderInput } from '../utils/validateScenarioBuilderInput';

/**
 * Scenario Builder — 06_TASKS.md M6-004 ("Create Scenario Builder") +
 * M6-005 ("Implement Price Scenario Simulation", Batch 4). M6-005 DoD:
 * "Portfolio values update using Simulation Service outputs."
 *
 * **Controlled inputs with live, per-keystroke validation — not
 * `react-hook-form`'s Preview/Apply submit cycle** `app/portfolio/page.tsx`'s
 * own forms use. `03_UI.md` Page 5's own "DESIGN PHILOSOPHY" is explicit
 * and is the opposite of that pattern: "Every input updates the
 * simulation immediately. No 'Calculate' button. No 'Run Simulation'
 * button." A submit-gated form would directly contradict this task's
 * own governing design principle, so this batch uses plain `useState` +
 * `validateScenarioBuilderInput` (this feature's own pure validator)
 * instead of reusing the Portfolio forms' own submit-oriented
 * machinery.
 *
 * **M6-005's own "Support" list, mapped one item at a time**: "Manual
 * price" is the BTC Price input (M6-004, Batch 3); "Percentage change"
 * is the new Percentage Change input below, wired the same way; "Preset
 * scenarios" is the new Preset Scenarios button row — each button sets
 * a fixed `percentageChange` scenario directly (see
 * `../types/scenarioBuilder.ts`'s own header comment for the 8-vs-7
 * preset-count reasoning); "Custom scenarios" is not a fourth,
 * separate mechanism — `03_UI.md` Page 5's own wording ("Users may also
 * define custom scenarios") describes the two free-form inputs
 * themselves, as opposed to the fixed presets, not a new input type.
 *
 * **Price-scenario fields (BTC Price, Percentage Change) and the
 * Collateral/Debt Change fields (M6-008, Batch 5) are wired to real
 * calculations; the rest are not.** Borrow rate, Target Health Factor,
 * and Time horizon belong to their own later, dedicated tasks (M6-006,
 * no later task, M6-007 respectively; Target Health Factor has no later
 * task naming it as an input anywhere, a genuine specification gap —
 * see `../types/scenarioBuilder.ts`'s own header comment). Wiring them
 * here would be pre-empting those tasks' own scope.
 *
 * **Collateral Change / Debt Change call `runPortfolioActionSimulation`
 * (M6-008, `services/simulation/portfolioAction.ts`), a separate Store
 * action and result field from the price-scenario `runSimulation`/
 * `currentResult` pair** — a portfolio action ("Add collateral,"
 * "Withdraw collateral," "Borrow," "Repay," "Combined actions") is a
 * structurally different calculation from a price/interest scenario,
 * so it does not share `currentScenario`/`currentResult`. Each field
 * change re-sends BOTH deltas together (not just the one that changed),
 * since the Service call is a single snapshot of "collateral delta +
 * debt delta applied together" — this is what naturally satisfies
 * "Combined actions" without a separate action-type input.
 *
 * **No Engine access from this component** — `04_BUILD_GUIDE.md`'s own
 * "DEPENDENCY RULES": "Only services communicate directly with the
 * Formula Engine." A percentage-change scenario is sent to
 * `simulateScenario` (via the Store) exactly as entered; this component
 * never imports `resolveScenarioPrice` (F-051) or computes a resolved
 * dollar price itself to preview in the BTC Price field — doing so
 * would mean either reaching into `@/engine` directly (forbidden) or
 * re-deriving F-051's own formula a second time in the UI layer
 * (duplicated calculation). The resolved price becomes visible once
 * M6-009 ("Implement Scenario Summary") renders `currentResult`.
 */
function defaultFormValues(portfolio: ApplicationPortfolio): ScenarioBuilderFormValues {
  return {
    btcPriceUsd: String(portfolio.market.btcPriceUsd),
    percentageChange: '',
    borrowApr: String(portfolio.protocol.borrowApr),
    collateralDelta: '0',
    debtDelta: '0',
    targetHealthFactor: '',
    holdingPeriod: '30',
    customHoldingPeriodDays: '',
  };
}

function formatPreset(percentageChange: number): string {
  const sign = percentageChange > 0 ? '+' : '';
  return `${sign}${Math.round(percentageChange * 100)}%`;
}

const HOLDING_PERIOD_OPTIONS: { value: HoldingPeriod; label: string }[] = [
  { value: '30', label: '30 Days' },
  { value: '90', label: '90 Days' },
  { value: '180', label: '180 Days' },
  { value: '365', label: '365 Days' },
  { value: 'custom', label: 'Custom' },
];

export function ScenarioBuilder({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const [values, setValues] = useState<ScenarioBuilderFormValues>(() =>
    defaultFormValues(portfolio),
  );
  const setCurrentScenario = useSimulationStore((state) => state.setCurrentScenario);
  const runSimulation = useSimulationStore((state) => state.runSimulation);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );
  const resetSimulation = useSimulationStore((state) => state.reset);

  const errors = validateScenarioBuilderInput(values, portfolio);

  function updateField<K extends keyof ScenarioBuilderFormValues>(
    field: K,
    value: ScenarioBuilderFormValues[K],
  ) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    if (field === 'btcPriceUsd') {
      const nextErrors = validateScenarioBuilderInput(nextValues, portfolio);
      if (nextErrors.btcPriceUsd !== null) return;
      const btcPriceUsd = Number(nextValues.btcPriceUsd);
      setCurrentScenario({ type: 'price', priceScenario: { type: 'absolute', btcPriceUsd } });
      runSimulation(portfolio);
      return;
    }

    if (field === 'percentageChange') {
      if (nextValues.percentageChange.trim() === '') return;
      const nextErrors = validateScenarioBuilderInput(nextValues, portfolio);
      if (nextErrors.percentageChange !== null) return;
      const percentageChange = Number(nextValues.percentageChange);
      setCurrentScenario({
        type: 'price',
        priceScenario: { type: 'percentageChange', percentageChange },
      });
      runSimulation(portfolio);
      return;
    }

    if (field === 'collateralDelta' || field === 'debtDelta') {
      const nextErrors = validateScenarioBuilderInput(nextValues, portfolio);
      if (nextErrors.collateralDelta !== null || nextErrors.debtDelta !== null) return;
      runPortfolioActionSimulation(portfolio, {
        collateralDelta: Number(nextValues.collateralDelta),
        debtDelta: Number(nextValues.debtDelta),
      });
    }
  }

  function applyPreset(percentageChange: number) {
    updateField('percentageChange', String(percentageChange));
  }

  function handleReset() {
    setValues(defaultFormValues(portfolio));
    resetSimulation();
  }

  return (
    <form className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>BTC Price</span>
        <input
          type="number"
          step="any"
          value={values.btcPriceUsd}
          onChange={(event) => updateField('btcPriceUsd', event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.btcPriceUsd && <span className="text-xs text-destructive">{errors.btcPriceUsd}</span>}

      <label className="flex flex-col gap-1 text-sm">
        <span>Percentage Change (0–1)</span>
        <input
          type="number"
          step="any"
          placeholder="e.g. 0.10 for +10%"
          value={values.percentageChange}
          onChange={(event) => updateField('percentageChange', event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.percentageChange && (
        <span className="text-xs text-destructive">{errors.percentageChange}</span>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm">Preset Scenarios</span>
        <div className="flex flex-wrap gap-2">
          {PRICE_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-md border border-border px-2 py-1 text-xs font-medium text-foreground hover:bg-accent/40"
            >
              {formatPreset(preset)}
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span>Borrow Rate (0–1)</span>
        <input
          type="number"
          step="any"
          value={values.borrowApr}
          onChange={(event) => updateField('borrowApr', event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.borrowApr && <span className="text-xs text-destructive">{errors.borrowApr}</span>}

      <label className="flex flex-col gap-1 text-sm">
        <span>Collateral Change (BTC)</span>
        <input
          type="number"
          step="any"
          value={values.collateralDelta}
          onChange={(event) => updateField('collateralDelta', event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.collateralDelta && (
        <span className="text-xs text-destructive">{errors.collateralDelta}</span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Debt Change (USD)</span>
        <input
          type="number"
          step="any"
          value={values.debtDelta}
          onChange={(event) => updateField('debtDelta', event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.debtDelta && <span className="text-xs text-destructive">{errors.debtDelta}</span>}

      <label className="flex flex-col gap-1 text-sm">
        <span>Target Health Factor</span>
        <input
          type="number"
          step="any"
          value={values.targetHealthFactor}
          onChange={(event) => updateField('targetHealthFactor', event.target.value)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.targetHealthFactor && (
        <span className="text-xs text-destructive">{errors.targetHealthFactor}</span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Holding Period</span>
        <select
          value={values.holdingPeriod}
          onChange={(event) => updateField('holdingPeriod', event.target.value as HoldingPeriod)}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        >
          {HOLDING_PERIOD_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {values.holdingPeriod === 'custom' && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span>Custom Holding Period (days)</span>
            <input
              type="number"
              step="1"
              value={values.customHoldingPeriodDays}
              onChange={(event) => updateField('customHoldingPeriodDays', event.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.customHoldingPeriodDays && (
            <span className="text-xs text-destructive">{errors.customHoldingPeriodDays}</span>
          )}
        </>
      )}

      <button
        type="button"
        onClick={handleReset}
        className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Reset Scenario
      </button>
    </form>
  );
}

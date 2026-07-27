'use client';

import { useState } from 'react';

import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import type { HoldingPeriod, ScenarioBuilderFormValues } from '../types/scenarioBuilder';
import {
  hasScenarioBuilderErrors,
  validateScenarioBuilderInput,
} from '../utils/validateScenarioBuilderInput';

/**
 * Scenario Builder — 06_TASKS.md M6-004 ("Create Scenario Builder").
 * Dependencies: M6-003, M3-009. DoD: "Scenario inputs are validated
 * before calculation."
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
 * **Only BTC Price is wired to a real calculation this batch.**
 * M6-004's own Dependencies name only M3-009 (`simulateScenario`,
 * price/interest scenarios) — the other five fields (Borrow rate,
 * Collateral delta, Debt delta, Target Health Factor, Time horizon)
 * belong to their own later, dedicated tasks (M6-006, M6-008, M6-007
 * respectively; Target Health Factor has no later task naming it as an
 * input anywhere, a genuine specification gap — see
 * `../types/scenarioBuilder.ts`'s own header comment). Wiring them here
 * would be pre-empting those tasks' own scope. Every field is still
 * real, controlled, and validated per this task's own literal DoD —
 * only the live-calculation trigger is scoped to the one field whose
 * Service dependency this task actually names.
 */
function defaultFormValues(portfolio: ApplicationPortfolio): ScenarioBuilderFormValues {
  return {
    btcPriceUsd: String(portfolio.market.btcPriceUsd),
    borrowApr: String(portfolio.protocol.borrowApr),
    collateralDelta: '0',
    debtDelta: '0',
    targetHealthFactor: '',
    holdingPeriod: '30',
    customHoldingPeriodDays: '',
  };
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
  const resetSimulation = useSimulationStore((state) => state.reset);

  const errors = validateScenarioBuilderInput(values, portfolio);

  function updateField<K extends keyof ScenarioBuilderFormValues>(
    field: K,
    value: ScenarioBuilderFormValues[K],
  ) {
    const nextValues = { ...values, [field]: value };
    setValues(nextValues);

    if (field !== 'btcPriceUsd') return;
    const nextErrors = validateScenarioBuilderInput(nextValues, portfolio);
    if (hasScenarioBuilderErrors(nextErrors)) return;

    const btcPriceUsd = Number(nextValues.btcPriceUsd);
    setCurrentScenario({ type: 'price', priceScenario: { type: 'absolute', btcPriceUsd } });
    runSimulation(portfolio);
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

'use client';

import { useState } from 'react';

import { formatCurrency, formatHealthFactor, formatPercent } from '@/components/strategy/format';
import { type ApplicationPortfolio, type SimulationScenario } from '@/services';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

/**
 * Loop Scenario Sensitivity — 06_TASKS.md M7-015 ("Implement Loop
 * Scenario Sensitivity"). Dependencies: M7-010, M3-009. Priority P1,
 * Effort L. Description: "Test the proposed loop under adverse
 * conditions." Display: "Health Factor under stress, Liquidation
 * distance under stress, Equity under stress, Debt cost under stress."
 * DoD: "Users can stress-test a loop before committing to it."
 *
 * **All 4 named Display items are satisfied verbatim by `ScenarioSummary`
 * itself** (`equity`/`healthFactor`/`liquidationDistance`/`debtCost` —
 * `engine/simulation/compareScenarios.ts`), already computed by the
 * already-public `simulateScenario` (M3-009) — zero new Formula Engine
 * logic. `runSensitivityScenario` (`stores/loopBuilderStore.ts`, this
 * same batch) calls it against `buildFinalLoopPortfolio`'s output — the
 * proposed loop's own final state — so "baseline" in the resulting
 * `SimulationResult` is the proposed loop itself, and "scenario" is that
 * same position under the adverse assumption below.
 *
 * **4 presets, matching common stress-test framings, not invented
 * thresholds** — none is drawn from any specification document (none
 * names a specific stress percentage), so each is a documented, labeled
 * assumption rather than a claimed formula: BTC Price Decline (-25%,
 * `{type:'price'}`), Borrow-Rate Increase (+5 percentage points over the
 * effective rate, `{type:'interest', timeHorizonDays:365}` — a time
 * horizon is required by `SimulationScenario`'s own `interest` variant
 * even though this preset's intent is rate-only, so price is held flat
 * via `percentageChange: 0`), Combined Stress (both together), and
 * Custom (a plain inline form, letting the user supply their own price
 * change / Borrow APR — no RHF/Zod, since M7-015 names no Requirements
 * section calling for validated form input, unlike M7-008's Loop
 * Strategy Controls).
 *
 * **`overflow-x-auto` + `tabIndex={0}` wrapper (M7-039/M7-040, Batch
 * 7)** — the same fix, and the same reasoning, as
 * `ExitPriceSensitivity.tsx`'s own header comment documents.
 */
type PresetId = 'priceDecline' | 'rateIncrease' | 'combined' | 'custom';

const PRICE_DECLINE_PERCENT = -0.25;
const RATE_INCREASE_DELTA = 0.05;
const HORIZON_DAYS = 365;

export function LoopScenarioSensitivity({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const currentResult = useLoopBuilderStore((state) => state.currentResult);
  const settings = useLoopBuilderStore((state) => state.settings);
  const sensitivityResult = useLoopBuilderStore((state) => state.sensitivityResult);
  const sensitivityErrors = useLoopBuilderStore((state) => state.sensitivityErrors);
  const runSensitivityScenario = useLoopBuilderStore((state) => state.runSensitivityScenario);

  const [activePreset, setActivePreset] = useState<PresetId | null>(null);
  const [customPriceChange, setCustomPriceChange] = useState('-0.10');
  const [customBorrowApr, setCustomBorrowApr] = useState('');

  if (currentResult === null || currentResult.strategy === null || settings === null) {
    return (
      <p className="text-sm text-muted-foreground">
        Configure a viable strategy to stress-test it.
      </p>
    );
  }

  const effectiveBorrowApr = settings.borrowAprOverride ?? portfolio.protocol.borrowApr;

  function runPreset(preset: PresetId) {
    setActivePreset(preset);
    if (preset === 'priceDecline') {
      runSensitivityScenario(portfolio, {
        type: 'price',
        priceScenario: { type: 'percentageChange', percentageChange: PRICE_DECLINE_PERCENT },
      });
    } else if (preset === 'rateIncrease') {
      runSensitivityScenario(portfolio, {
        type: 'interest',
        priceScenario: { type: 'percentageChange', percentageChange: 0 },
        timeHorizonDays: HORIZON_DAYS,
        borrowApr: effectiveBorrowApr + RATE_INCREASE_DELTA,
      });
    } else if (preset === 'combined') {
      runSensitivityScenario(portfolio, {
        type: 'interest',
        priceScenario: { type: 'percentageChange', percentageChange: PRICE_DECLINE_PERCENT },
        timeHorizonDays: HORIZON_DAYS,
        borrowApr: effectiveBorrowApr + RATE_INCREASE_DELTA,
      });
    }
  }

  function runCustom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivePreset('custom');
    const scenario: SimulationScenario = {
      type: 'interest',
      priceScenario: {
        type: 'percentageChange',
        percentageChange: Number(customPriceChange),
      },
      timeHorizonDays: HORIZON_DAYS,
      borrowApr: customBorrowApr.trim() === '' ? effectiveBorrowApr : Number(customBorrowApr),
    };
    runSensitivityScenario(portfolio, scenario);
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => runPreset('priceDecline')}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          BTC Price Decline (-25%)
        </button>
        <button
          type="button"
          onClick={() => runPreset('rateIncrease')}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Borrow-Rate Increase (+5pp)
        </button>
        <button
          type="button"
          onClick={() => runPreset('combined')}
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Combined Stress
        </button>
      </div>

      <form onSubmit={runCustom} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Custom BTC Price Change
          <input
            type="number"
            step="0.01"
            value={customPriceChange}
            onChange={(event) => setCustomPriceChange(event.target.value)}
            className="w-32 rounded border border-border px-2 py-1 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Custom Borrow APR (optional)
          <input
            type="number"
            step="0.001"
            value={customBorrowApr}
            onChange={(event) => setCustomBorrowApr(event.target.value)}
            className="w-32 rounded border border-border px-2 py-1 text-sm text-foreground"
          />
        </label>
        <button
          type="submit"
          className="rounded border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          Run Custom Scenario
        </button>
      </form>

      {sensitivityErrors.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {sensitivityErrors.map((error) => error.message).join(' ')}
        </p>
      )}

      {sensitivityResult !== null && activePreset !== null && (
        <div className="overflow-x-auto" tabIndex={0}>
          <table className="w-full min-w-[480px] text-sm">
            <caption className="sr-only">Loop scenario sensitivity</caption>
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th scope="col" className="py-1">
                  Metric
                </th>
                <th scope="col" className="py-1">
                  Proposed Loop
                </th>
                <th scope="col" className="py-1">
                  Under Stress
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="py-1 text-muted-foreground">Health Factor</td>
                <td className="py-1 text-foreground">
                  {formatHealthFactor(sensitivityResult.baseline.healthFactor)}
                </td>
                <td className="py-1 text-foreground">
                  {formatHealthFactor(sensitivityResult.scenario.healthFactor)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Liquidation Distance</td>
                <td className="py-1 text-foreground">
                  {formatPercent(sensitivityResult.baseline.liquidationDistance)}
                </td>
                <td className="py-1 text-foreground">
                  {formatPercent(sensitivityResult.scenario.liquidationDistance)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Equity</td>
                <td className="py-1 text-foreground">
                  {formatCurrency(sensitivityResult.baseline.equity)}
                </td>
                <td className="py-1 text-foreground">
                  {formatCurrency(sensitivityResult.scenario.equity)}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-muted-foreground">Debt Cost</td>
                <td className="py-1 text-foreground">
                  {formatCurrency(sensitivityResult.baseline.debtCost)}
                </td>
                <td className="py-1 text-foreground">
                  {formatCurrency(sensitivityResult.scenario.debtCost)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

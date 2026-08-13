'use client';

import { useEffect, useState } from 'react';

import type { ApplicationPortfolio } from '@/services';
import { useSimulationStore } from '@/stores/simulationStore';

import {
  type HoldingPeriod,
  PRICE_PRESETS,
  type ScenarioBuilderFormValues,
} from '../types/scenarioBuilder';
import { resolveInterestScenario } from '../utils/resolveScenarioInputs';
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
 * **Price-scenario fields (BTC Price, Percentage Change), the
 * Collateral/Debt Change fields (M6-008, Batch 5), Borrow Rate (M6-006,
 * Batch 6), and Holding Period/Custom Duration (M6-007, Batch 7) are
 * wired to real calculations; only Target Health Factor is not.**
 * Target Health Factor has no later task naming it as an input
 * anywhere, a genuine specification gap — see
 * `../types/scenarioBuilder.ts`'s own header comment.
 *
 * **Borrow Rate calls `simulateScenario` with `type: 'interest'`
 * (M6-006, Batch 6)** — `simulateInterestScenario` (M2-020)
 * structurally requires a `priceScenario` and `timeHorizonDays`
 * alongside `borrowApr`, so changing Borrow Rate resolves both from the
 * form's own current, already-validated state
 * (`resolveInterestScenario`, `resolveScenarioInputs.ts`) rather than
 * requiring a fourth "just change the rate" input shape the Service
 * doesn't have. "Rate increase," "Rate decrease," and "Custom rate"
 * (M6-006's own Include list) are all satisfied by this one free-form
 * field — M6-006, unlike M6-005, names no preset buttons.
 *
 * **Holding Period / Custom Holding Period Days initiate or re-run the
 * interest scenario (M6-007, Batch 7; trigger condition fixed PT-12,
 * physical-testing round 2; interaction-order fix PT-12 follow-up 2)** —
 * satisfying M6-007's own Description ("Project portfolio changes over
 * time") and `03_UI.md` Page 5's own "HOLDING PERIOD" section ("Interest
 * calculations use the selected period") literally: a live projection
 * changes when the assumed time span changes, regardless of what other
 * fields were touched, in what order, beforehand. Unconditional, the
 * same as the Borrow Rate handler below — no longer gated on
 * `currentScenario?.type`. The original PT-12 fix (physical-testing
 * round 2) still guarded this on `currentScenario?.type === 'price'`,
 * meaning to leave a deliberate price-only stress test undisturbed; the
 * PT-12 follow-up round found that gate was actually the reverse-order
 * cause of its own reported bug: BTC Price/Percentage Change are always
 * touched first in the ordinary physical flow (Holding Period already
 * shows its pre-filled "30 Days" default, so there's no reason to
 * re-select it before anything else), which sets `currentScenario` to
 * `type: 'price'` — and once that happened, this gate permanently
 * blocked Holding Period from ever promoting to `'interest'` for the
 * rest of the session, no matter how many times it was changed
 * afterward. Removing the gate makes Holding Period behave exactly like
 * Borrow Rate already does (unconditional promotion/refresh via
 * `resolveInterestScenario`), which is what "Interest Cost must always
 * be derived from the currently displayed Borrow Rate + Holding Period,
 * regardless of prior scenario interactions" actually requires. Time
 * horizon has no meaning for a `type: 'price'` scenario
 * (`SimulationScenario`'s own price variant has no `timeHorizonDays`
 * field at all), but that is no longer a reason to withhold the
 * conversion — a `type: 'price'` scenario is what Holding Period is
 * always meant to convert *into* `type: 'interest'`.
 *
 * **BTC Price / Percentage Change preserve an already-active interest
 * scenario instead of silently demoting it back to `type: 'price'`
 * (PT-12 follow-up, physical-testing round 2)** — the PT-12 fix above
 * made Holding Period able to *start* an interest scenario, but left the
 * BTC Price/Percentage Change handlers unconditionally rebuilding a bare
 * `type: 'price'` scenario on every edit, discarding whatever Borrow
 * Rate/Holding Period was already active. Since a `type: 'price'`
 * scenario's own `debtCost` is always the unprorated annual figure (see
 * `services/simulation/scenario.ts`'s own `calculateAnnualInterest`
 * call for a price scenario — unmodified here), that silent demotion is
 * what made Interest Cost jump back to the annual value the instant BTC
 * Price/Percentage Change was touched again, and kept it stuck there
 * afterward (including returning the price back to its original value),
 * since nothing ever re-promoted the scenario back to `type: 'interest'`.
 * Fixed the same way the Holding Period gate already reads intent from
 * `currentScenario?.type`: when it is already `'interest'`, these two
 * fields now resolve through the same, unmodified `resolveInterestScenario`
 * path instead, updating only the price side while keeping Borrow Rate/
 * Holding Period intact.
 *
 * **M6-007's own DoD ("Time assumptions are clearly displayed") is
 * satisfied by the Holding Period `<select>` and the conditionally
 * shown Custom Holding Period input themselves** — both are already
 * real, visible, always-current form controls (Batch 3), not hidden
 * state; the currently assumed time span is continuously on screen by
 * construction. This differs from M6-006's own DoD ("Users understand
 * the cost implications"), which needed a *calculated result* value no
 * control already displays and was explicitly deferred to M6-009 as a
 * documented conflict (see Batch 6's own PROJECT_STATUS.md write-up) —
 * no equivalent gap exists here, so no new display element was built.
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
 *
 * **Borrow Rate / Holding Period / Custom Holding Period Days also call
 * `runTimelineProjection` (M6-012, Batch 11)** right after `runSimulation`
 * — the Scenario Timeline (`ScenarioTimeline.tsx`) needs to stay in sync
 * with whatever interest scenario is currently active, the same "every
 * input updates immediately" principle already governing every other
 * field. `runTimelineProjection` itself no-ops (clears the timeline)
 * when no interest scenario is active, so this is safe to call from
 * every interest-relevant field unconditionally.
 *
 * **Per-field validation errors were investigated for M6-022's own
 * "Forms" Review item (Batch 21, "Accessibility Review") and
 * deliberately left as visually-adjacent text, not given
 * `aria-describedby`/`aria-invalid`, at the time.** A real, targeted
 * `axe-core` scan against a triggered validation error found zero WCAG
 * violations — the visible error text alone already satisfied the
 * automated bar. Fixing it only here would have been inconsistent with
 * every other form in the codebase, and fixing it everywhere was flagged
 * as scope beyond M6-022's own "Simulation Workspace" DoD, deferred
 * rather than silently ignored. **06_TASKS.md M9-026 ("Audit Form
 * Accessibility") is exactly that later, codebase-wide batch** — every
 * field below now carries `id`/`aria-invalid`/`aria-describedby`,
 * applied consistently across every RHF and non-RHF form this batch
 * touches (see `LoopStrategyControls.tsx`'s own header comment for the
 * same fix applied there).
 */
/**
 * UX punch-list UX-01/UX-05 — percentage-scale UI boundary conversion.
 * `percentageChange`/`borrowApr` are plain `useState` string fields (not
 * RHF), so the same "raw decimal in, raw decimal out" that `simulateScenario`
 * expects is converted to/from the percentage a user actually types (e.g.
 * "10" for +10%) at exactly the three points below: `defaultFormValues`
 * (initial display), `applyPreset` (button click → displayed field), and
 * `resolveScenarioInputs.ts` (displayed field → decimal, right before it
 * reaches the Simulation Service). `PRICE_PRESETS` itself stays decimal —
 * only the string state a user sees/types is percentage-scale.
 */
function toPercentInput(decimal: number): string {
  return String(decimal * 100);
}

function defaultFormValues(portfolio: ApplicationPortfolio): ScenarioBuilderFormValues {
  return {
    btcPriceUsd: String(portfolio.market.btcPriceUsd),
    percentageChange: '',
    borrowApr: toPercentInput(portfolio.protocol.borrowApr),
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

export function ScenarioBuilder({
  portfolio,
  portfolioId,
}: {
  portfolio: ApplicationPortfolio;
  portfolioId: string;
}) {
  const [values, setValues] = useState<ScenarioBuilderFormValues>(() =>
    defaultFormValues(portfolio),
  );
  const currentScenario = useSimulationStore((state) => state.currentScenario);
  const setCurrentScenario = useSimulationStore((state) => state.setCurrentScenario);
  const runSimulation = useSimulationStore((state) => state.runSimulation);
  const runPortfolioActionSimulation = useSimulationStore(
    (state) => state.runPortfolioActionSimulation,
  );
  const runTimelineProjection = useSimulationStore((state) => state.runTimelineProjection);
  const resetSimulation = useSimulationStore((state) => state.reset);
  const syncActivePortfolio = useSimulationStore((state) => state.syncActivePortfolio);

  // 06_TASKS.md M9-012 ("Audit State Management") — "No cross-portfolio
  // contamination." Runs whenever `portfolioId` changes (including this
  // component's own mount, so a portfolio switched *while this route
  // wasn't mounted* is still caught) — see `syncActivePortfolio`'s own
  // doc comment in `stores/simulationStore.ts` for why this only clears
  // on an actual portfolio change, never on a same-portfolio remount
  // (e.g. navigating away and back), which must keep in-progress work.
  useEffect(() => {
    syncActivePortfolio(portfolioId);
  }, [portfolioId, syncActivePortfolio]);

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
      // PT-12 follow-up (physical testing round 2) — previously always
      // built a fresh `type: 'price'` scenario here, unconditionally
      // discarding an already-active `type: 'interest'` scenario's own
      // borrowApr/timeHorizonDays. Interest Cost for a `type: 'price'`
      // scenario is always the full annual figure (no time-horizon
      // proration — see services/simulation/scenario.ts's own
      // calculateAnnualInterest call, unchanged here), so that silent
      // demotion is what made Interest Cost revert to the annual value
      // the moment BTC Price/Percentage Change was touched again, even
      // though Holding Period was still visibly selected on screen. When
      // an interest scenario is already active, this field is resolved
      // through the same `resolveInterestScenario` path the Holding
      // Period/Borrow Rate handlers already use, preserving the active
      // Borrow Rate + Holding Period while only the price input changes.
      if (currentScenario?.type === 'interest') {
        const scenario = resolveInterestScenario(nextValues, portfolio);
        if (scenario === null) return;
        setCurrentScenario(scenario);
        runSimulation(portfolio);
        runTimelineProjection(portfolio);
        return;
      }
      const btcPriceUsd = Number(nextValues.btcPriceUsd);
      setCurrentScenario({ type: 'price', priceScenario: { type: 'absolute', btcPriceUsd } });
      runSimulation(portfolio);
      return;
    }

    if (field === 'percentageChange') {
      if (nextValues.percentageChange.trim() === '') return;
      const nextErrors = validateScenarioBuilderInput(nextValues, portfolio);
      if (nextErrors.percentageChange !== null) return;
      // PT-12 follow-up — same fix as btcPriceUsd above, for the same
      // reason: preserve an already-active interest scenario instead of
      // silently demoting it back to a bare price scenario.
      if (currentScenario?.type === 'interest') {
        const scenario = resolveInterestScenario(nextValues, portfolio);
        if (scenario === null) return;
        setCurrentScenario(scenario);
        runSimulation(portfolio);
        runTimelineProjection(portfolio);
        return;
      }
      const percentageChange = Number(nextValues.percentageChange) / 100;
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
      return;
    }

    if (field === 'borrowApr') {
      const scenario = resolveInterestScenario(nextValues, portfolio);
      if (scenario === null) return;
      setCurrentScenario(scenario);
      runSimulation(portfolio);
      runTimelineProjection(portfolio);
      return;
    }

    if (field === 'holdingPeriod' || field === 'customHoldingPeriodDays') {
      // PT-12 (physical-testing round 2) fixed the trigger condition so
      // this no longer requires an *already-active* interest scenario.
      // PT-12 follow-up (round 2) removed the `currentScenario?.type ===
      // 'price'` guard this handler used to have: in the ordinary
      // physical interaction order (BTC Price/Percentage Change touched
      // first, since Holding Period already shows its pre-filled "30
      // Days" default and looks already set), that guard permanently
      // blocked Holding Period from ever promoting to `'interest'` once
      // any price field had been edited — reproducing the exact reported
      // regression (Interest Cost stuck at the annual figure, unmoved by
      // Holding Period, for the rest of the session). Unconditional now,
      // matching the Borrow Rate handler immediately above — the same,
      // unmodified `resolveInterestScenario` formula path, just no
      // longer gated on prior scenario-type history.
      const scenario = resolveInterestScenario(nextValues, portfolio);
      if (scenario === null) return;
      setCurrentScenario(scenario);
      runSimulation(portfolio);
      runTimelineProjection(portfolio);
    }
  }

  function applyPreset(percentageChange: number) {
    updateField('percentageChange', toPercentInput(percentageChange));
  }

  function handleReset() {
    setValues(defaultFormValues(portfolio));
    resetSimulation();
  }

  return (
    <form className="flex flex-col gap-4">
      {/* PT-11 (physical-testing round 2) — these two fieldsets, and the
          intro sentence below, are the fix: `services/simulation/scenario.ts`'s
          own header comment documents that price/interest scenarios and
          portfolio actions are genuinely independent Store fields/Service
          calls by spec ("Scope: price and interest scenarios only, not
          position-change... forcing it into this same ScenarioSummary
          shape would require inventing a 'profit or loss' meaning...
          that no document defines"), so this is a presentation fix, not
          a formula change — the two groups below (and their matching
          "Price / Interest Scenario" / "Portfolio Action" result
          sections in ScenarioSummary.tsx) now share the same explicit
          naming and grouping so the separation reads as intentional
          rather than looking like one broken combined scenario. */}
      <p className="text-xs text-muted-foreground">
        The two groups below are independent &ldquo;what if&rdquo; scenarios — changing a field in
        one does not affect the other, and each has its own separate result below.
      </p>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Price / Interest Scenario</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>BTC Price</span>
          <input
            id="btcPriceUsd"
            type="number"
            step="any"
            value={values.btcPriceUsd}
            onChange={(event) => updateField('btcPriceUsd', event.target.value)}
            aria-invalid={errors.btcPriceUsd ? 'true' : undefined}
            aria-describedby={errors.btcPriceUsd ? 'btcPriceUsd-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.btcPriceUsd && (
          <span id="btcPriceUsd-error" className="text-xs text-destructive">
            {errors.btcPriceUsd}
          </span>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span>Percentage Change (%)</span>
          <input
            id="percentageChange"
            type="number"
            step="any"
            placeholder="e.g. 10 for +10%"
            value={values.percentageChange}
            onChange={(event) => updateField('percentageChange', event.target.value)}
            aria-invalid={errors.percentageChange ? 'true' : undefined}
            aria-describedby={errors.percentageChange ? 'percentageChange-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.percentageChange && (
          <span id="percentageChange-error" className="text-xs text-destructive">
            {errors.percentageChange}
          </span>
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
          <span>Borrow Rate (%)</span>
          <input
            id="borrowApr"
            type="number"
            step="any"
            value={values.borrowApr}
            onChange={(event) => updateField('borrowApr', event.target.value)}
            aria-invalid={errors.borrowApr ? 'true' : undefined}
            aria-describedby={errors.borrowApr ? 'borrowApr-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.borrowApr && (
          <span id="borrowApr-error" className="text-xs text-destructive">
            {errors.borrowApr}
          </span>
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
                id="customHoldingPeriodDays"
                type="number"
                step="1"
                value={values.customHoldingPeriodDays}
                onChange={(event) => updateField('customHoldingPeriodDays', event.target.value)}
                aria-invalid={errors.customHoldingPeriodDays ? 'true' : undefined}
                aria-describedby={
                  errors.customHoldingPeriodDays ? 'customHoldingPeriodDays-error' : undefined
                }
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </label>
            {errors.customHoldingPeriodDays && (
              <span id="customHoldingPeriodDays-error" className="text-xs text-destructive">
                {errors.customHoldingPeriodDays}
              </span>
            )}
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-foreground">Portfolio Action</legend>
        <label className="flex flex-col gap-1 text-sm">
          <span>Collateral Change (BTC)</span>
          <input
            id="collateralDelta"
            type="number"
            step="any"
            value={values.collateralDelta}
            onChange={(event) => updateField('collateralDelta', event.target.value)}
            aria-invalid={errors.collateralDelta ? 'true' : undefined}
            aria-describedby={errors.collateralDelta ? 'collateralDelta-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.collateralDelta && (
          <span id="collateralDelta-error" className="text-xs text-destructive">
            {errors.collateralDelta}
          </span>
        )}

        <label className="flex flex-col gap-1 text-sm">
          <span>Debt Change (USD)</span>
          <input
            id="debtDelta"
            type="number"
            step="any"
            value={values.debtDelta}
            onChange={(event) => updateField('debtDelta', event.target.value)}
            aria-invalid={errors.debtDelta ? 'true' : undefined}
            aria-describedby={errors.debtDelta ? 'debtDelta-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        {errors.debtDelta && (
          <span id="debtDelta-error" className="text-xs text-destructive">
            {errors.debtDelta}
          </span>
        )}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        <span>Target Health Factor</span>
        <input
          id="targetHealthFactor"
          type="number"
          step="any"
          value={values.targetHealthFactor}
          onChange={(event) => updateField('targetHealthFactor', event.target.value)}
          aria-invalid={errors.targetHealthFactor ? 'true' : undefined}
          aria-describedby={errors.targetHealthFactor ? 'targetHealthFactor-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.targetHealthFactor && (
        <span id="targetHealthFactor-error" className="text-xs text-destructive">
          {errors.targetHealthFactor}
        </span>
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

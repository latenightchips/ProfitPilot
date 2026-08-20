'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';

import type { ApplicationPortfolio } from '@/services';
import type { LoopStrategySettings } from '@/services/loop/strategy';
import { useLoopBuilderStore } from '@/stores/loopBuilderStore';

import {
  type LoopStrategyControlsFormValues,
  loopStrategyControlsSchema,
} from '../types/loopStrategyControls';
import { resolveBorrowRateAssumption } from '../utils/resolveBorrowRateAssumption';
import { resolveMaxLoanToValueAssumption } from '../utils/resolveMaxLoanToValueAssumption';

/**
 * Loop Strategy Controls — 06_TASKS.md M7-008 ("Implement Loop Strategy
 * Controls"). Dependencies: M7-007. Priority P0, Effort L. Inputs:
 * "Starting portfolio, Borrow percentage per step, Maximum number of
 * loops, Minimum Health Factor, Maximum LTV, Swap fee, Slippage, Gas
 * estimate, Borrow-rate assumption." Requirements: "Use React Hook Form
 * and Zod. Show validation before calculation." DoD: "Only valid
 * strategy inputs reach the Loop Strategy Service."
 *
 * **The one component in this milestone to use React Hook Form +
 * Zod directly, unlike `ScenarioBuilder.tsx` (M6-004).** Simulation's
 * own Scenario Builder deliberately used plain `useState` + a hand-
 * written validator, because M6-004 named no RHF/Zod requirement and
 * `03_UI.md` Page 5's own DESIGN PHILOSOPHY explicitly forbids a
 * submit-gated form ("No 'Calculate' button"). M7-008's own
 * Requirements explicitly name RHF and Zod — a genuine, literal
 * difference from M6-004, honored here rather than defaulting to the
 * closest precedent. This does not contradict Page 6's own "All values
 * update instantly" philosophy or M7-010's own "Debounce live previews"
 * Requirement — see the field-level onChange design below.
 *
 * **"Starting portfolio" is not a form field.** It is the active
 * portfolio, already selected before this route is reachable
 * (`app/loop-builder/page.tsx`'s own "no active portfolio" gate,
 * mirroring `app/simulation/page.tsx`) — shown as read-only context
 * elsewhere on the route (the shared `StrategyComparison`'s own
 * "Current" column), not a fourth thing to configure here.
 *
 * **"Swap fee," "Slippage," and "Gas estimate" are not form fields
 * either — a deliberate, documented scope decision, not an oversight.**
 * Conflict #8 (no Formula ID or equation for any of the three anywhere
 * in `02_Formulas.md`) means there is no Service parameter for them to
 * reach; rendering editable inputs with nowhere for their values to go
 * would be exactly the "dead affordance" this codebase has consistently
 * avoided (see `features/dashboard/types/recommendationSummary.ts`'s
 * own "View all action — not built" reasoning). They are already
 * itemized as unavailable, with the documented reason, by the shared
 * `StrategyAssumptionsPanel` (M7-004, Batch 1) this route also renders
 * — reused, not duplicated as dead inputs here.
 *
 * **"Maximum LTV" and "Borrow-rate assumption" are real, wired
 * overrides**, pre-filled from the portfolio's own current risk-capacity
 * value — (V3) `protocol.maxLoanToValue`, (V4) the canonical
 * `v4CollateralRisk.collateralFactor`, both via `resolveMaxLoanToValueAssumption`
 * — and (V3) `protocol.borrowApr` / (V4) the canonical
 * `deriveAaveV4EffectiveBorrowRate` boundary — see
 * `services/loop/strategy.ts`'s own header comment for the Service-
 * layer substitution these two fields drive
 * (`maxLoanToValueOverride`/`borrowAprOverride`, both optional there).
 *
 * **`maxLoanToValueOverride` and `borrowAprOverride` are each submitted
 * only once their own field has been genuinely established — V4
 * Readiness Audit §12 Stage 17 (rate), BLOCKER #2 fix (LTV, same
 * mechanism).** Neither field's *default displayed value* is itself a
 * user override — for a V4 portfolio the LTV field's default is
 * `v4CollateralRisk.collateralFactor`, which should keep tracking the
 * real synced collateral risk for as long as the user hasn't actually
 * typed a value into that field. Before the BLOCKER #2 fix,
 * `maxLoanToValueOverride` was submitted unconditionally on every field
 * edit — so touching e.g. Maximum Number of Loops on a V4 portfolio
 * silently froze the LTV field's *displayed default* (seeded from the
 * legacy `protocol.maxLoanToValue`, itself also wrong for V4 before this
 * fix) into a permanent override, which `services/loop/strategy.ts`
 * always lets win over the correct dispatched risk-capacity fraction.
 * `maxLoanToValueEstablishedRef`/`rateEstablishedRef` (below) each track
 * this per field: flips to `true` only when that field's own `onChange`
 * fires, or when an externally pushed `settings` object (a preset click)
 * already carries a concrete override. `handleFieldChange` — shared by
 * every *other* field — omits an override from `nextSettings` entirely
 * while its ref is still `false`, so editing an unrelated field cannot
 * silently freeze either displayed default into a permanent override;
 * `services/loop/strategy.ts`'s own fallback (`settings.maxLoanToValueOverride`/
 * `settings.borrowAprOverride === undefined`) then keeps deriving the
 * real value on every run, exactly as if this form had never touched
 * that field at all.
 *
 * **Per-field validation errors now carry `aria-describedby`/
 * `aria-invalid` (06_TASKS.md M9-026 "Audit Form Accessibility")** —
 * this closes the gap M6-022 ("Accessibility Review") investigated and
 * explicitly deferred; see `ScenarioBuilder.tsx`'s own header comment
 * for that original decision, now revisited here and in every other RHF
 * form this batch touches for the same reason.
 *
 * **Resyncs its own displayed values whenever the Store's `settings`
 * change from a source other than this form itself — a real bug found
 * and fixed during this batch's own mandatory manual browser
 * verification, not a hypothetical.** `LoopPresets.tsx` (M7-009) calls
 * `setSettings` directly, bypassing this form entirely; without the
 * `useEffect` below, clicking a preset silently left every field
 * showing its old, now-inaccurate value while the Store (and every
 * calculated result) had already moved on — directly contradicting
 * M7-009's own literal DoD ("Selecting a preset updates editable
 * controls without hiding any input"). `lastPushedSettingsRef` tracks
 * the exact settings *this* form itself last pushed, so the effect can
 * tell "the Store changed because I typed" (skip — the fields already
 * show what was just typed) apart from "the Store changed because
 * something else set it" (resync).
 *
 * **Deterministic, structurally-guaranteed synchronization: no
 * `watch()` subscription, no ref-flag/microtask guard.** An earlier
 * implementation used RHF's broad `watch()` API to drive the debounce,
 * which observes *every* value change — including the ones `reset()`
 * itself causes when the resync effect fires. A first fix attempt
 * gated `watch()`'s callback behind a ref flag cleared via
 * `queueMicrotask`, but that only narrows the race window; it does not
 * close it, since the flag's clearing and the store/DOM update it's
 * guarding are not the same atomic operation — a stale debounced push
 * from typing, or a redundant one scheduled by `reset()`'s own
 * re-broadcast, could still fire and overwrite a just-applied external
 * settings change under different timer/scheduler behavior. The
 * debounce is now driven exclusively by each `<input>`'s own real
 * `onChange` — passed as `register(name, { onChange })`, RHF's
 * documented mechanism for reacting to a *specific field's* real DOM
 * change event, called in addition to RHF's own internal handling
 * (validation still runs on every change via `mode: 'onChange'`,
 * unaffected). Setting an input's value imperatively — which is
 * exactly what `reset()` does, and the only way this form's displayed
 * values ever change outside direct typing — never dispatches a native
 * `change` event, so `register`'s `onChange` option is structurally
 * never invoked by `reset()`. This is not a timing-dependent guard: a
 * programmatic reset *cannot* schedule a debounce, by construction,
 * regardless of React/RHF/timer scheduling in any environment. The
 * resync effect additionally cancels any already-pending debounce
 * before calling `reset()` (`cancelPendingPush()`), so a stale user
 * edit that was mid-flight when an external preset/settings change
 * arrives can never fire after the fact and overwrite it —
 * `handleReset` does the same. See
 * `tests/unit/features/loop-builder/LoopStrategyControls.test.tsx`'s own
 * "a pending debounced edit is cancelled..." regression tests.
 */
const DEBOUNCE_MS = 300;

/**
 * UX punch-list UX-06 — percentage-scale UI boundary conversion.
 * `borrowPercentagePerStep`/`maxLoanToValue`/`borrowRateAssumption` remain
 * stored as a 0–1 fraction throughout `LoopStrategySettings`
 * (`services/loop/strategy.ts`) and `LoopPresets.tsx` (unchanged — presets
 * keep producing byte-identical internal values); this form's own
 * `LoopStrategyControlsFormValues`/`loopStrategyControlsSchema` are the
 * one place a fraction becomes the "50" a user types, converted at
 * exactly two points: `defaultFormValues`/`toFormValues` (decimal →
 * display) and `handleFieldChange`'s `nextSettings` construction (display
 * → decimal, the only place a value re-enters `LoopStrategySettings`).
 */
function toPercentInput(decimal: number): number {
  return decimal * 100;
}

function fromPercentInput(percent: number): number {
  return percent / 100;
}

function defaultFormValues(portfolio: ApplicationPortfolio): LoopStrategyControlsFormValues {
  return {
    borrowPercentagePerStep: 50,
    maxLoops: 3,
    minHealthFactor: 1.5,
    maxLoanToValue: toPercentInput(resolveMaxLoanToValueAssumption(portfolio) ?? 0),
    borrowRateAssumption: toPercentInput(resolveBorrowRateAssumption(portfolio) ?? 0),
  };
}

function toFormValues(settings: LoopStrategySettings): LoopStrategyControlsFormValues {
  return {
    borrowPercentagePerStep: toPercentInput(settings.targetBorrowPercentage),
    maxLoops: settings.maxLoops,
    minHealthFactor: settings.minHealthFactor,
    maxLoanToValue: toPercentInput(settings.maxLoanToValueOverride ?? 0),
    borrowRateAssumption: toPercentInput(settings.borrowAprOverride ?? 0),
  };
}

function settingsEqual(a: LoopStrategySettings, b: LoopStrategySettings): boolean {
  return (
    a.targetBorrowPercentage === b.targetBorrowPercentage &&
    a.maxLoops === b.maxLoops &&
    a.minHealthFactor === b.minHealthFactor &&
    a.maxLoanToValueOverride === b.maxLoanToValueOverride &&
    a.borrowAprOverride === b.borrowAprOverride
  );
}

export function LoopStrategyControls({
  portfolio,
  portfolioId,
}: {
  portfolio: ApplicationPortfolio;
  portfolioId: string;
}) {
  const settings = useLoopBuilderStore((state) => state.settings);
  const setSettings = useLoopBuilderStore((state) => state.setSettings);
  const runLoopStrategy = useLoopBuilderStore((state) => state.runLoopStrategy);
  const resetLoopBuilder = useLoopBuilderStore((state) => state.reset);
  const syncActivePortfolio = useLoopBuilderStore((state) => state.syncActivePortfolio);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedSettingsRef = useRef<LoopStrategySettings | null>(null);
  // V4 Readiness Audit §12 Stage 17 — see this file's own header comment
  // ("...submitted only once...") for the full reasoning. `false` means
  // the displayed rate is still an auto-seeded default (V3's
  // `protocol.borrowApr`, or V4's live canonical rate), never a real
  // user override.
  const rateEstablishedRef = useRef(false);
  // BLOCKER #2 fix — same mechanism as `rateEstablishedRef`, for the
  // Maximum LTV field. `false` means the displayed value is still an
  // auto-seeded default (V3's `protocol.maxLoanToValue`, or V4's real
  // `v4CollateralRisk.collateralFactor`), never a real user override.
  const maxLoanToValueEstablishedRef = useRef(false);

  const {
    register,
    getValues,
    reset,
    formState: { errors },
  } = useForm<LoopStrategyControlsFormValues>({
    resolver: zodResolver(loopStrategyControlsSchema),
    mode: 'onChange',
    defaultValues: defaultFormValues(portfolio),
  });

  function cancelPendingPush() {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  // 06_TASKS.md M9-012 ("Audit State Management") — "No cross-portfolio
  // contamination." Runs whenever `portfolioId` changes (including this
  // component's own mount, so a portfolio switched *while this route
  // wasn't mounted* is still caught). Placed as the first effect, before
  // the `settings`-reactive effect below, so a genuine portfolio change
  // clears the Store's `settings` before that effect's own
  // `if (settings === null) return;` guard evaluates against fresh
  // state.
  useEffect(() => {
    syncActivePortfolio(portfolioId);
  }, [portfolioId, syncActivePortfolio]);

  useEffect(() => {
    if (settings === null) return;
    if (
      lastPushedSettingsRef.current !== null &&
      settingsEqual(lastPushedSettingsRef.current, settings)
    ) {
      return;
    }
    cancelPendingPush();
    lastPushedSettingsRef.current = settings;
    rateEstablishedRef.current = settings.borrowAprOverride !== undefined;
    maxLoanToValueEstablishedRef.current = settings.maxLoanToValueOverride !== undefined;
    reset(toFormValues(settings));
  }, [settings, reset]);

  useEffect(() => cancelPendingPush, []);

  function handleFieldChange() {
    cancelPendingPush();
    debounceRef.current = setTimeout(() => {
      const parsed = loopStrategyControlsSchema.safeParse(getValues());
      if (!parsed.success) return;

      const nextSettings: LoopStrategySettings = {
        targetBorrowPercentage: fromPercentInput(parsed.data.borrowPercentagePerStep),
        maxLoops: parsed.data.maxLoops,
        minHealthFactor: parsed.data.minHealthFactor,
        ...(maxLoanToValueEstablishedRef.current && {
          maxLoanToValueOverride: fromPercentInput(parsed.data.maxLoanToValue),
        }),
        ...(rateEstablishedRef.current && {
          borrowAprOverride: fromPercentInput(parsed.data.borrowRateAssumption),
        }),
      };
      lastPushedSettingsRef.current = nextSettings;
      setSettings(nextSettings);
      runLoopStrategy(portfolio);
    }, DEBOUNCE_MS);
  }

  // V4 Readiness Audit §12 Stage 17 — the rate field's own `onChange`,
  // wrapping `handleFieldChange` instead of registering it directly.
  // Establishing the ref here (before the shared debounce even starts)
  // means the very edit that touches this field is itself included as a
  // real override, not dropped by the `rateEstablishedRef.current`
  // gate above.
  function handleRateFieldChange() {
    rateEstablishedRef.current = true;
    handleFieldChange();
  }

  // BLOCKER #2 fix — same wrapping as `handleRateFieldChange`, for the
  // Maximum LTV field's own `onChange`.
  function handleMaxLoanToValueFieldChange() {
    maxLoanToValueEstablishedRef.current = true;
    handleFieldChange();
  }

  function handleReset() {
    cancelPendingPush();
    lastPushedSettingsRef.current = null;
    rateEstablishedRef.current = false;
    maxLoanToValueEstablishedRef.current = false;
    reset(defaultFormValues(portfolio));
    resetLoopBuilder();
  }

  return (
    <form className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>How much to borrow each loop (%)</span>
        <input
          id="borrowPercentagePerStep"
          type="number"
          step="any"
          {...register('borrowPercentagePerStep', {
            valueAsNumber: true,
            onChange: handleFieldChange,
          })}
          aria-invalid={errors.borrowPercentagePerStep ? 'true' : undefined}
          aria-describedby={
            errors.borrowPercentagePerStep ? 'borrowPercentagePerStep-error' : undefined
          }
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
        <span className="text-xs text-muted-foreground">
          At each step, how much of your new borrowing capacity to actually borrow, as a percentage
          (e.g. 50 for 50%). A higher number reaches more leverage in fewer steps, but leaves less
          safety margin at each one.
        </span>
      </label>
      {errors.borrowPercentagePerStep && (
        <span id="borrowPercentagePerStep-error" className="text-xs text-destructive">
          {errors.borrowPercentagePerStep.message}
        </span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Maximum Number of Loops</span>
        <input
          id="maxLoops"
          type="number"
          step="1"
          {...register('maxLoops', { valueAsNumber: true, onChange: handleFieldChange })}
          aria-invalid={errors.maxLoops ? 'true' : undefined}
          aria-describedby={errors.maxLoops ? 'maxLoops-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.maxLoops && (
        <span id="maxLoops-error" className="text-xs text-destructive">
          {errors.maxLoops.message}
        </span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Minimum Health Factor</span>
        <input
          id="minHealthFactor"
          type="number"
          step="any"
          {...register('minHealthFactor', { valueAsNumber: true, onChange: handleFieldChange })}
          aria-invalid={errors.minHealthFactor ? 'true' : undefined}
          aria-describedby={errors.minHealthFactor ? 'minHealthFactor-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
        <span className="text-xs text-muted-foreground">
          Health Factor measures how close your position is to liquidation — above 1 is safe, below
          1 means your collateral could be liquidated. This strategy stops adding loops before
          Health Factor would drop below the number you set here, so a higher value is more
          conservative.
        </span>
      </label>
      {errors.minHealthFactor && (
        <span id="minHealthFactor-error" className="text-xs text-destructive">
          {errors.minHealthFactor.message}
        </span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Maximum LTV (%)</span>
        <input
          id="maxLoanToValue"
          type="number"
          step="any"
          {...register('maxLoanToValue', {
            valueAsNumber: true,
            onChange: handleMaxLoanToValueFieldChange,
          })}
          aria-invalid={errors.maxLoanToValue ? 'true' : undefined}
          aria-describedby={errors.maxLoanToValue ? 'maxLoanToValue-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
        <span className="text-xs text-muted-foreground">
          The most you can borrow against your collateral, as a percentage (e.g. 75 for 75%).
          Pre-filled from your portfolio&apos;s current risk-capacity setting.
        </span>
      </label>
      {errors.maxLoanToValue && (
        <span id="maxLoanToValue-error" className="text-xs text-destructive">
          {errors.maxLoanToValue.message}
        </span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Borrow interest rate assumption (%)</span>
        <input
          id="borrowRateAssumption"
          type="number"
          step="any"
          {...register('borrowRateAssumption', {
            valueAsNumber: true,
            onChange: handleRateFieldChange,
          })}
          aria-invalid={errors.borrowRateAssumption ? 'true' : undefined}
          aria-describedby={errors.borrowRateAssumption ? 'borrowRateAssumption-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
        <span className="text-xs text-muted-foreground">
          The annual interest rate assumed on borrowed funds, as a percentage (e.g. 5 for 5%), used
          to estimate this strategy&apos;s ongoing cost.
        </span>
      </label>
      {errors.borrowRateAssumption && (
        <span id="borrowRateAssumption-error" className="text-xs text-destructive">
          {errors.borrowRateAssumption.message}
        </span>
      )}

      <button
        type="button"
        onClick={handleReset}
        className="mt-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Reset Strategy
      </button>
    </form>
  );
}

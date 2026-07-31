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
 * overrides**, pre-filled from the portfolio's own current
 * `protocol.maxLoanToValue`/`protocol.borrowApr` — see
 * `services/loop/strategy.ts`'s own header comment for the Service-
 * layer substitution these two fields drive
 * (`maxLoanToValueOverride`/`borrowAprOverride`, both optional there;
 * always concretely supplied from this form).
 *
 * **Per-field validation errors are visually-adjacent text, not given
 * `aria-describedby`/`aria-invalid`** — the same investigated-and-
 * declined decision `ScenarioBuilder.tsx`'s own header comment
 * documents for M6-022 ("Accessibility Review"), applied consistently
 * here rather than introducing a new pattern only for this form.
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

function defaultFormValues(portfolio: ApplicationPortfolio): LoopStrategyControlsFormValues {
  return {
    borrowPercentagePerStep: 0.5,
    maxLoops: 3,
    minHealthFactor: 1.5,
    maxLoanToValue: portfolio.protocol.maxLoanToValue,
    borrowRateAssumption: portfolio.protocol.borrowApr,
  };
}

function toFormValues(settings: LoopStrategySettings): LoopStrategyControlsFormValues {
  return {
    borrowPercentagePerStep: settings.targetBorrowPercentage,
    maxLoops: settings.maxLoops,
    minHealthFactor: settings.minHealthFactor,
    maxLoanToValue: settings.maxLoanToValueOverride ?? 0,
    borrowRateAssumption: settings.borrowAprOverride ?? 0,
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

export function LoopStrategyControls({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const settings = useLoopBuilderStore((state) => state.settings);
  const setSettings = useLoopBuilderStore((state) => state.setSettings);
  const runLoopStrategy = useLoopBuilderStore((state) => state.runLoopStrategy);
  const resetLoopBuilder = useLoopBuilderStore((state) => state.reset);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedSettingsRef = useRef<LoopStrategySettings | null>(null);

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
    reset(toFormValues(settings));
  }, [settings, reset]);

  useEffect(() => cancelPendingPush, []);

  function handleFieldChange() {
    cancelPendingPush();
    debounceRef.current = setTimeout(() => {
      const parsed = loopStrategyControlsSchema.safeParse(getValues());
      if (!parsed.success) return;

      const nextSettings: LoopStrategySettings = {
        targetBorrowPercentage: parsed.data.borrowPercentagePerStep,
        maxLoops: parsed.data.maxLoops,
        minHealthFactor: parsed.data.minHealthFactor,
        maxLoanToValueOverride: parsed.data.maxLoanToValue,
        borrowAprOverride: parsed.data.borrowRateAssumption,
      };
      lastPushedSettingsRef.current = nextSettings;
      setSettings(nextSettings);
      runLoopStrategy(portfolio);
    }, DEBOUNCE_MS);
  }

  function handleReset() {
    cancelPendingPush();
    lastPushedSettingsRef.current = null;
    reset(defaultFormValues(portfolio));
    resetLoopBuilder();
  }

  return (
    <form className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span>Borrow Percentage Per Step (0–1)</span>
        <input
          type="number"
          step="any"
          {...register('borrowPercentagePerStep', {
            valueAsNumber: true,
            onChange: handleFieldChange,
          })}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.borrowPercentagePerStep && (
        <span className="text-xs text-destructive">{errors.borrowPercentagePerStep.message}</span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Maximum Number of Loops</span>
        <input
          type="number"
          step="1"
          {...register('maxLoops', { valueAsNumber: true, onChange: handleFieldChange })}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.maxLoops && (
        <span className="text-xs text-destructive">{errors.maxLoops.message}</span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Minimum Health Factor</span>
        <input
          type="number"
          step="any"
          {...register('minHealthFactor', { valueAsNumber: true, onChange: handleFieldChange })}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.minHealthFactor && (
        <span className="text-xs text-destructive">{errors.minHealthFactor.message}</span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Maximum LTV (0–1)</span>
        <input
          type="number"
          step="any"
          {...register('maxLoanToValue', { valueAsNumber: true, onChange: handleFieldChange })}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.maxLoanToValue && (
        <span className="text-xs text-destructive">{errors.maxLoanToValue.message}</span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Borrow-Rate Assumption (0–1)</span>
        <input
          type="number"
          step="any"
          {...register('borrowRateAssumption', {
            valueAsNumber: true,
            onChange: handleFieldChange,
          })}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.borrowRateAssumption && (
        <span className="text-xs text-destructive">{errors.borrowRateAssumption.message}</span>
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

'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { type Resolver, useForm } from 'react-hook-form';

import type { ApplicationPortfolio } from '@/services';
import {
  type ExitPlannerTargetInputs,
  type ExitPlannerType,
  useExitPlannerStore,
} from '@/stores/exitPlannerStore';

import { exitTargetFormSchemas } from '../types/exitTargetForm';

/**
 * Exit Target Form — 06_TASKS.md M7-022 ("Implement Exit Target Form").
 * Dependencies: M7-021. Priority P0, Effort L. Inputs may include:
 * "Target BTC price, Debt repayment amount, Target Health Factor, BTC
 * quantity to retain, Debt balance to retain, Cash proceeds target,
 * Fees, Slippage, Gas estimate." Requirements: "Use React Hook Form and
 * Zod. Clearly distinguish target price from current price." DoD:
 * "Invalid or impossible target inputs are rejected with useful
 * messages." Also wires M7-023 ("Implement Exit Calculation Workflow")
 * — see below.
 *
 * **Renders exactly one type-specific field, keyed by the Store's own
 * `exitType`** (`FIELD_BY_TYPE`) — satisfies M7-021's own "Display only
 * fields relevant to the selected exit type" Requirement. "Target BTC
 * price" (`scenarioBtcPriceUsd`) is the one field shown for every type,
 * always paired with the portfolio's own real current price rendered
 * by the shared `StrategyAssumptionsPanel` this route also shows —
 * satisfying "Clearly distinguish target price from current price."
 *
 * **Remounted via `key={exitType}` in the parent `ExitTargetForm`
 * export, not resynced via a `reset()` effect like
 * `LoopStrategyControls.tsx`.** A full remount is the simpler,
 * equally-deterministic choice here: unlike Loop Builder (where
 * `LoopPresets.tsx` writes full `LoopStrategySettings` values directly,
 * requiring the controls form to resync its displayed values to match),
 * nothing in this batch writes `targetInputs` from outside this form —
 * `ExitTypeSelector.tsx` only ever writes `exitType`, and switching
 * `exitType` is exactly the case a remount already handles correctly
 * (fresh `useForm` state, no stale field values from the previous
 * type). If a later batch adds an Exit equivalent of Loop Presets that
 * writes `targetInputs` directly while the same type stays selected,
 * this form will need the same resync-effect treatment
 * `LoopStrategyControls.tsx` already established — not needed yet.
 *
 * **Deterministic, structurally-guaranteed calculation triggering — the
 * same field-level `onChange` design `LoopStrategyControls.tsx`
 * established after Batch 2's own `watch()`-based race was found and
 * fixed.** No `watch()` subscription; each `<input>`'s own real
 * `onChange` (`register(name, { onChange: handleFieldChange })`) drives
 * a 300ms debounce that re-parses the type's own schema and, on
 * success, calls `setTargetInputs` + `runExitCalculation` together —
 * the Store action pairing `handleFieldChange` already establishes for
 * Loop's `setSettings`/`runLoopStrategy`.
 *
 * **"Full exit" has no field to type into at all** — selecting the
 * type is already sufficient information to calculate (`targetDebt: 0`
 * needs no user-supplied number). Triggered once on mount instead of
 * from a field's `onChange`, the only structural difference from the
 * other 4 types.
 *
 * **Validation is format-level only (Zod: sign, positivity) — "useful
 * messages" for genuine infeasibility (e.g. a repayment amount larger
 * than the current debt) come from the Engine's own already-computed,
 * already-tested `infeasibleReason` via `stores/exitPlannerStore.ts`'s
 * own `warnings` mapping, not a second, UI-layer feasibility check that
 * could disagree with it.**
 */
const FIELD_BY_TYPE: Record<
  ExitPlannerType,
  { name: keyof ExitPlannerTargetInputs; label: string } | null
> = {
  fullExit: null,
  partialDebtRepayment: { name: 'repaymentAmount', label: 'Debt Repayment Amount (USD)' },
  targetHealthFactor: { name: 'targetHealthFactor', label: 'Target Health Factor' },
  targetRetainedBtc: { name: 'targetRetainedBtc', label: 'BTC Quantity to Retain' },
  targetDebtBalance: { name: 'targetDebtBalance', label: 'Target Debt Balance (USD)' },
};

const DEBOUNCE_MS = 300;

function ExitTargetFormForType({
  exitType,
  portfolio,
}: {
  exitType: ExitPlannerType;
  portfolio: ApplicationPortfolio;
}) {
  const setTargetInputs = useExitPlannerStore((state) => state.setTargetInputs);
  const runExitCalculation = useExitPlannerStore((state) => state.runExitCalculation);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    getValues,
    formState: { errors },
  } = useForm<ExitPlannerTargetInputs>({
    // `exitTargetFormSchemas[exitType]` is a per-type schema whose output
    // is always a valid subset of `ExitPlannerTargetInputs` (every field
    // there is optional) — TS cannot narrow the indexed-access union to
    // one member from a runtime `exitType` value, so the cast just
    // restates what `exitTargetFormSchemas`'s own `satisfies
    // Record<ExitPlannerType, z.ZodType>` constraint already guarantees.
    resolver: zodResolver(exitTargetFormSchemas[exitType]) as Resolver<ExitPlannerTargetInputs>,
    mode: 'onChange',
    defaultValues: {},
  });

  function cancelPendingPush() {
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }

  function pushTargetInputs() {
    const parsed = exitTargetFormSchemas[exitType].safeParse(getValues());
    if (!parsed.success) return;
    setTargetInputs(parsed.data);
    runExitCalculation(portfolio);
  }

  function handleFieldChange() {
    cancelPendingPush();
    debounceRef.current = setTimeout(pushTargetInputs, DEBOUNCE_MS);
  }

  useEffect(() => cancelPendingPush, []);

  useEffect(() => {
    if (exitType === 'fullExit') {
      setTargetInputs({});
      runExitCalculation(portfolio);
    }
    // Only on mount — this component is remounted via `key={exitType}`
    // whenever the type changes, so this fires exactly once per Full
    // Exit selection. `setTargetInputs`/`runExitCalculation` are stable
    // Zustand action references; `portfolio`/`exitType` are constant
    // for this mounted instance's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const field = FIELD_BY_TYPE[exitType];

  return (
    <form className="flex flex-col gap-3">
      {field && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span>{field.label}</span>
            <input
              type="number"
              step="any"
              {...register(field.name, { valueAsNumber: true, onChange: handleFieldChange })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors[field.name] && (
            <span className="text-xs text-destructive">{errors[field.name]?.message}</span>
          )}
        </>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Target BTC Price (USD) — optional, defaults to the current price</span>
        <input
          type="number"
          step="any"
          {...register('scenarioBtcPriceUsd', {
            valueAsNumber: true,
            onChange: handleFieldChange,
          })}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.scenarioBtcPriceUsd && (
        <span className="text-xs text-destructive">{errors.scenarioBtcPriceUsd.message}</span>
      )}
    </form>
  );
}

export function ExitTargetForm({ portfolio }: { portfolio: ApplicationPortfolio }) {
  const exitType = useExitPlannerStore((state) => state.exitType);

  if (exitType === null) {
    return (
      <p className="text-sm text-muted-foreground">Select an exit approach above to continue.</p>
    );
  }

  return <ExitTargetFormForType key={exitType} exitType={exitType} portfolio={portfolio} />;
}

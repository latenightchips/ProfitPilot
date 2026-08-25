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
import type { ExecutionCostAssumptionsSettings } from '@/types/portfolio';

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
 * **Remounted via `key={exitType}` whenever `exitType` itself changes,
 * PLUS a resync effect for the same-type case — Milestone 7 Batch 6's
 * own Recommendation Action Links (M7-034) are exactly the
 * "later batch" this file's own Batch 4 comment anticipated.**
 * `RecommendationDetailPanel.tsx` calls `setExitType` + `setTargetInputs`
 * directly, bypassing this form entirely, the same "writes `targetInputs`
 * from outside this form" case `LoopPresets.tsx` (M7-009) already
 * established for Loop Builder's `LoopStrategyControls.tsx`. Two real
 * gaps were found and fixed during Batch 6's own mandatory manual
 * browser verification, not hypothetical: (1) `defaultValues: {}` meant
 * a fresh mount (the common case — navigating in from the
 * Recommendation Center, which always calls `setExitType` first,
 * forcing a remount via the changed `key`) never actually displayed the
 * prefilled value, even though the Store's own `targetInputs` was
 * already correct; (2) if the *same* `exitType` was already selected
 * (no remount), an external `setTargetInputs` call had no effect on the
 * displayed fields at all. `defaultValues: exitInitialTargetInputs`
 * fixes (1); the `useEffect` below, modeled directly on
 * `LoopStrategyControls.tsx`'s own resync effect, fixes (2) —
 * `lastPushedTargetInputsRef` distinguishes "the Store changed because
 * *this form* just typed" (skip, matching `lastPushedSettingsRef`'s own
 * role there) from "the Store changed because something else set it"
 * (resync). Calculation-triggering is intentionally NOT this effect's
 * job — `RecommendationDetailPanel.tsx` calls `runExitCalculation`
 * itself, pairing it with `setTargetInputs` the same way
 * `pushTargetInputs` below and the Full Exit mount effect already do;
 * this effect only keeps the visible fields honest.
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
 *
 * **`aria-describedby`/`aria-invalid` added on both fields (06_TASKS.md
 * M9-026 "Audit Form Accessibility")** — see `LoopStrategyControls.tsx`'s
 * own header comment for the M6-022-deferred gap this closes across
 * every RHF form this batch touches.
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

/** Field-by-field, matching `LoopStrategyControls.tsx`'s own `settingsEqual` precedent. */
function targetInputsEqual(a: ExitPlannerTargetInputs, b: ExitPlannerTargetInputs): boolean {
  return (
    a.repaymentAmount === b.repaymentAmount &&
    a.targetHealthFactor === b.targetHealthFactor &&
    a.targetRetainedBtc === b.targetRetainedBtc &&
    a.targetDebtBalance === b.targetDebtBalance &&
    a.scenarioBtcPriceUsd === b.scenarioBtcPriceUsd
  );
}

function ExitTargetFormForType({
  exitType,
  portfolio,
  executionCostAssumptions,
}: {
  exitType: ExitPlannerType;
  portfolio: ApplicationPortfolio;
  /** The active portfolio's own `settings.executionCostAssumptions` (V4 Readiness Audit §12 P1-6) — see `exitPlannerStore.ts`'s `runExitCalculation` for why this is a separate prop, not read from `portfolio` itself. */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings;
}) {
  const targetInputs = useExitPlannerStore((state) => state.targetInputs);
  const setTargetInputs = useExitPlannerStore((state) => state.setTargetInputs);
  const runExitCalculation = useExitPlannerStore((state) => state.runExitCalculation);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Tracks what *this form itself* last pushed to the Store, so the
  // resync effect below can tell that apart from an external write.
  const lastPushedTargetInputsRef = useRef<ExitPlannerTargetInputs | null>(
    useExitPlannerStore.getState().targetInputs,
  );

  const {
    register,
    getValues,
    reset,
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
    // Reads the Store's *current* value once, at construction — this
    // component always fully remounts when `exitType` changes (`key`
    // below), so this is the fresh-navigation case (e.g. a
    // Recommendation Center action link, which always sets `exitType`
    // first). The same-type case is handled by the resync effect below.
    defaultValues: useExitPlannerStore.getState().targetInputs ?? {},
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
    lastPushedTargetInputsRef.current = parsed.data;
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
      lastPushedTargetInputsRef.current = {};
      setTargetInputs({});
      runExitCalculation(portfolio, executionCostAssumptions);
    }
    // Only on mount — this component is remounted via `key={exitType}`
    // whenever the type changes, so this fires exactly once per Full
    // Exit selection. `setTargetInputs`/`runExitCalculation` are stable
    // Zustand action references; `portfolio`/`exitType` are constant
    // for this mounted instance's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (targetInputs === null) return;
    if (
      lastPushedTargetInputsRef.current !== null &&
      targetInputsEqual(lastPushedTargetInputsRef.current, targetInputs)
    ) {
      return;
    }
    cancelPendingPush();
    lastPushedTargetInputsRef.current = targetInputs;
    reset(targetInputs);
  }, [targetInputs, reset]);

  const field = FIELD_BY_TYPE[exitType];

  return (
    <form className="flex flex-col gap-3">
      {field && (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span>{field.label}</span>
            <input
              id={field.name}
              type="number"
              step="any"
              {...register(field.name, { valueAsNumber: true, onChange: handleFieldChange })}
              aria-invalid={errors[field.name] ? 'true' : undefined}
              aria-describedby={errors[field.name] ? `${field.name}-error` : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors[field.name] && (
            <span id={`${field.name}-error`} className="text-xs text-destructive">
              {errors[field.name]?.message}
            </span>
          )}
        </>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>Target BTC Price (USD) — optional, defaults to the current price</span>
        <input
          id="scenarioBtcPriceUsd"
          type="number"
          step="any"
          {...register('scenarioBtcPriceUsd', {
            valueAsNumber: true,
            onChange: handleFieldChange,
          })}
          aria-invalid={errors.scenarioBtcPriceUsd ? 'true' : undefined}
          aria-describedby={errors.scenarioBtcPriceUsd ? 'scenarioBtcPriceUsd-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.scenarioBtcPriceUsd && (
        <span id="scenarioBtcPriceUsd-error" className="text-xs text-destructive">
          {errors.scenarioBtcPriceUsd.message}
        </span>
      )}
    </form>
  );
}

export function ExitTargetForm({
  portfolio,
  portfolioId,
  executionCostAssumptions,
}: {
  portfolio: ApplicationPortfolio;
  portfolioId: string;
  /** The active portfolio's own `settings.executionCostAssumptions` (V4 Readiness Audit §12 P1-6) — see `exitPlannerStore.ts`'s `runExitCalculation` for why this is a separate prop, not read from `portfolio` itself. */
  executionCostAssumptions?: ExecutionCostAssumptionsSettings;
}) {
  const exitType = useExitPlannerStore((state) => state.exitType);
  const syncActivePortfolio = useExitPlannerStore((state) => state.syncActivePortfolio);

  // 06_TASKS.md M9-012 ("Audit State Management") — "No cross-portfolio
  // contamination." Runs whenever `portfolioId` changes (including this
  // component's own mount, so a portfolio switched *while this route
  // wasn't mounted* is still caught) — see `syncActivePortfolio`'s own
  // doc comment in `stores/exitPlannerStore.ts` for why this only clears
  // on an actual portfolio change, never on a same-portfolio remount.
  useEffect(() => {
    syncActivePortfolio(portfolioId);
  }, [portfolioId, syncActivePortfolio]);

  if (exitType === null) {
    return (
      <p className="text-sm text-muted-foreground">Select an exit approach above to continue.</p>
    );
  }

  return (
    <ExitTargetFormForType
      key={exitType}
      exitType={exitType}
      portfolio={portfolio}
      executionCostAssumptions={executionCostAssumptions}
    />
  );
}

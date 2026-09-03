'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useAaveV4BaseDrawnRateStore } from '@/stores/aaveV4BaseDrawnRateStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import type { Portfolio } from '@/types/portfolio';
import { aaveV4CollateralRiskConfigSchema, aaveV4DebtStateSchema } from '@/types/portfolio.schema';

/**
 * Manual/Hypothetical Aave V4 entry — V4 Readiness Audit §12 Stage 25.
 * Closes the audit's own central finding: `AaveProtocolVersionForm`'s
 * address sub-form is the ONLY way today to ever populate `v4DebtState`/
 * `v4CollateralRisk` — a user with no real Aave V4 position, no wallet,
 * and no willingness to make an RPC call has no path to model a V4
 * portfolio at all. `setAaveV4DebtState`/`setAaveV4CollateralRisk`
 * (`stores/portfolioStore.ts`) were already fully generic — validated by
 * the same `aaveV4DebtStateSchema`/`aaveV4CollateralRiskConfigSchema`
 * regardless of caller, with zero RPC-provenance requirement — so this
 * component is the missing UI, not a new calculation or Store path. Once
 * either field is set here, `calculatePortfolioSummary`'s own
 * `checkAaveV4DebtStateAvailable`/`checkAaveV4CollateralRiskAvailable`
 * guards (`services/portfolio/mapping.ts`) see exactly the same real
 * value a live sync would have written, and every consumer (Dashboard,
 * Portfolio, Loop Builder, Exit Planner, Recommendations, Simulation)
 * calculates from it identically — no Service/Engine change was needed
 * or made for this stage.
 *
 * **Two independent sub-forms, not one** — "Debt and collateral-risk
 * provenance must remain independently representable... do not assume
 * they transition simultaneously" (this stage's own requirement). A user
 * can set/update just the debt assumptions, just the collateral-risk
 * assumption, or both, on their own schedule — mirroring why
 * `CollateralPositionForm`/`DebtPositionForm` are already two separate
 * components/forms rather than one, for the same "separate concerns,
 * separate save actions" reasoning.
 *
 * **Both calls pass `source: 'manual'` explicitly** — `setAaveV4DebtState`/
 * `setAaveV4CollateralRisk` default an omitted `source` to `'live'`
 * (correct for their original, live-sync-only callers), so this
 * component — the one genuinely new `'manual'` caller — must never omit
 * it. See `AaveV4DataSource`'s own doc comment (`services/portfolio/models.ts`)
 * for the full manual/live provenance model, and `utils/protocolStatus.ts`
 * for how a `'manual'` source is represented in the status badge
 * (`Aave V4 · Manual entry` — never `Waiting for address`, never blocked
 * as if something were missing).
 *
 * **`dynamicConfigKey` is never presented to the user, per this stage's
 * own explicit instruction** ("handle dynamicConfigKey explicitly as
 * non-live metadata... do not present it to the user as something they
 * must understand or enter"). It has no manual meaning — it records
 * which on-chain dynamic-config version a REAL `collateralFactor` read
 * was bound to (`AaveV4CollateralRiskConfig`'s own doc comment) — so a
 * manual submission always constructs it as `0`, a fixed sentinel this
 * component's own doc comment (and `AaveV4DataSource`'s) documents as
 * "not a real on-chain key"; provenance is tracked separately via
 * `v4CollateralRiskSource`, so nothing ever needs to interpret this
 * value on its own for a manual entry. Only the collateral-factor
 * percentage is collected — `aaveV4CollateralRiskConfigSchema.pick(...)`
 * reuses the exact same validator the live path itself is checked
 * against, never a second, hand-rolled bound.
 *
 * **Percentage fields use the exact same input convention already
 * established for V3's own manual entry** (`app/portfolios/new/NewPortfolioPageClient.tsx`'s
 * `fromPercentInput`) — the user types whole percentage points (e.g.
 * `5` for 5%), the field converts to the stored 0–1 decimal fraction on
 * submit, and pre-fills by converting the other way. No new
 * interpretation of what an APR or a collateral factor means or how it
 * is scaled — this stage's own explicit instruction.
 *
 * **Pre-fills from whatever the portfolio currently has**, regardless of
 * its current source — editing a live-synced value back down to a
 * manual assumption is a legitimate "what if" use (e.g. stress-testing a
 * different rate than what's currently live), and is exactly as
 * supported as first-time manual entry; nothing here special-cases "was
 * this live before." A live sync landing later still always wins on its
 * own schedule (`hooks/useAaveV4LiveSync.ts`/`useAaveV4CollateralRiskLiveSync.ts`'s
 * own "always transition to live on a successful fetch" fix, this same
 * stage) — this form does not need to prevent or warn about that.
 *
 * **BLOCKER #4 fix — both sub-forms now resync their displayed values
 * when the canonical portfolio field changes from OUTSIDE this
 * component**, e.g. `DebtPositionForm` applying a repayment while this
 * form is also mounted. Before this fix, `defaultValues` above was only
 * read once at mount (React Hook Form's own contract) — a genuinely
 * different `portfolio.v4DebtState`/`v4CollateralRisk` arriving later
 * left the displayed fields silently stale, so saving even an unrelated
 * field (e.g. only editing `riskPremium`) would resubmit the OTHER,
 * now-stale fields (`drawnDebt`/`premiumDebt`) too, silently reverting
 * the externally-applied change — the exact same stale-echo bug class
 * already fixed for `DebtPositionForm`'s own `debt.balance` field (see
 * that component's own "Stage 25A" comment in `PortfolioPageClient.tsx`,
 * whose `lastSynced`-ref + dirty-gated `reset()` pattern is reused here
 * verbatim, not reinvented). Each sub-form tracks its OWN dirty state
 * across its own field group — resync is skipped entirely while ANY of
 * that sub-form's fields are actively being edited (never clobbers
 * in-progress typing), and a successful submit calls `reset()` with the
 * just-saved values so the sync effect's own baseline advances too,
 * keeping the form resyncable for the NEXT external change rather than
 * getting permanently stuck "dirty" after the first save.
 *
 * **`baseDrawnApr` pre-fills from the live market rate (V4 Manual-Data /
 * Provenance Audit)** — `useAaveV4BaseDrawnRateStore` fetches
 * `IHub.getAssetDrawnRate` for `portfolio.debt.asset` with no wallet
 * involved, purely a convenience starting point for this otherwise fully
 * manual form. This does NOT change what this form submits as: every
 * save through `ManualDebtStateForm` still passes `source: 'manual'`
 * unconditionally, exactly as before — that invariant is deliberate (see
 * this file's own "Both calls pass `source: 'manual'` explicitly"
 * section above) and is not altered by where the starting number came
 * from. The field-level hint text next to `baseDrawnApr` alone
 * distinguishes "still the live market rate" from "you've edited it,"
 * without claiming the group as a whole is anything other than manual.
 */
function fromPercentInput(percent: number): number {
  return percent / 100;
}

function toPercentInput(fraction: number | undefined): number | undefined {
  return fraction !== undefined ? fraction * 100 : undefined;
}

function RequiredMark() {
  return <span aria-hidden="true">*</span>;
}

/**
 * `baseDrawnApr`-specific hint — V4 Manual-Data / Provenance Audit's
 * "manually overridden" scenario. Deliberately independent of this
 * form's other three fields (`drawnDebt`/`premiumDebt`/`riskPremium`
 * have no live source at all in this manual form) and never claims the
 * overall save is anything but `'manual'` — see this file's own header
 * comment.
 */
function baseDrawnAprHintText(
  status: ReturnType<typeof useAaveV4BaseDrawnRateStore.getState>['status'],
  prefilled: boolean,
  dirty: boolean,
): string {
  if (prefilled && dirty) {
    return 'Manually overridden — no longer the live market rate.';
  }
  if (prefilled) {
    return 'Aave V4 · Live market base drawn rate — edit to override.';
  }
  if (status === 'error') {
    return 'Live Aave V4 base drawn rate is unavailable right now — enter a value manually.';
  }
  return 'Checking for a live Aave V4 market base drawn rate…';
}

const manualDebtStateSchema = aaveV4DebtStateSchema;
type ManualDebtStateFormValues = z.input<typeof manualDebtStateSchema>;

const manualCollateralFactorSchema = aaveV4CollateralRiskConfigSchema.pick({
  collateralFactor: true,
});
type ManualCollateralFactorFormValues = z.input<typeof manualCollateralFactorSchema>;

function ManualDebtStateForm({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const setAaveV4DebtState = usePortfolioStore((state) => state.setAaveV4DebtState);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitSuccessful, dirtyFields },
  } = useForm<ManualDebtStateFormValues, unknown, z.infer<typeof manualDebtStateSchema>>({
    resolver: zodResolver(manualDebtStateSchema),
    defaultValues: {
      drawnDebt: portfolio.v4DebtState?.drawnDebt ?? 0,
      premiumDebt: portfolio.v4DebtState?.premiumDebt ?? 0,
      baseDrawnApr: toPercentInput(portfolio.v4DebtState?.baseDrawnApr) ?? 0,
      riskPremium: toPercentInput(portfolio.v4DebtState?.riskPremium) ?? 0,
    },
  });

  // BLOCKER #4 fix — mirrors `PortfolioPageClient.tsx`'s `DebtPositionForm`
  // own Stage 25A sync effect exactly; see this file's own header comment.
  const isDirty = Boolean(
    dirtyFields.drawnDebt ||
    dirtyFields.premiumDebt ||
    dirtyFields.baseDrawnApr ||
    dirtyFields.riskPremium,
  );
  const lastSyncedV4DebtState = useRef(portfolio.v4DebtState);

  useEffect(() => {
    if (isDirty) return;
    if (portfolio.v4DebtState === lastSyncedV4DebtState.current) return;
    reset({
      drawnDebt: portfolio.v4DebtState?.drawnDebt ?? 0,
      premiumDebt: portfolio.v4DebtState?.premiumDebt ?? 0,
      baseDrawnApr: toPercentInput(portfolio.v4DebtState?.baseDrawnApr) ?? 0,
      riskPremium: toPercentInput(portfolio.v4DebtState?.riskPremium) ?? 0,
    });
    lastSyncedV4DebtState.current = portfolio.v4DebtState;
  }, [isDirty, portfolio.v4DebtState, reset]);

  // `baseDrawnApr` live pre-fill (V4 Manual-Data / Provenance Audit) —
  // see this file's own header comment for why this does not change what
  // this form submits as (`source: 'manual'`, unconditionally, below).
  const [baseDrawnAprPrefilled, setBaseDrawnAprPrefilled] = useState(false);
  const fetchAaveV4BaseDrawnRate = useAaveV4BaseDrawnRateStore(
    (state) => state.fetchAaveV4BaseDrawnRate,
  );
  const baseDrawnRateStatus = useAaveV4BaseDrawnRateStore((state) => state.status);
  const baseDrawnRateCanonical = useAaveV4BaseDrawnRateStore((state) => state.canonical);
  const baseDrawnRateFetchedAsset = useAaveV4BaseDrawnRateStore((state) => state.debtAsset);

  useEffect(() => {
    void fetchAaveV4BaseDrawnRate(portfolio.debt.asset);
  }, [portfolio.debt.asset, fetchAaveV4BaseDrawnRate]);

  useEffect(() => {
    if (baseDrawnRateStatus !== 'ready' || baseDrawnRateCanonical === null) return;
    if (baseDrawnRateFetchedAsset !== portfolio.debt.asset) return;
    if (!dirtyFields.baseDrawnApr) {
      setValue('baseDrawnApr', toPercentInput(baseDrawnRateCanonical.baseDrawnApr) ?? 0, {
        shouldDirty: false,
      });
    }
    setBaseDrawnAprPrefilled(true);
  }, [
    baseDrawnRateStatus,
    baseDrawnRateCanonical,
    baseDrawnRateFetchedAsset,
    portfolio.debt.asset,
    dirtyFields.baseDrawnApr,
    setValue,
  ]);

  const onSubmit = handleSubmit((data) => {
    // V4 Mixed-Provenance UX batch — `baseDrawnApr`'s own provenance is
    // tracked independently from the rest of this always-`'manual'`
    // group: if the field currently on screen is still the unedited live
    // market rate (`baseDrawnAprPrefilled && !dirtyFields.baseDrawnApr`,
    // the exact same condition `baseDrawnAprHintText` above already
    // renders as "Aave V4 · Live market base drawn rate"), saving must
    // record that honestly as `'live'`, not silently fold it into this
    // form's own unconditional `'manual'` for `drawnDebt`/`premiumDebt`/
    // `riskPremium`. See `ApplicationPortfolio.v4BaseDrawnAprSource`'s
    // own doc comment (`services/portfolio/models.ts`).
    const baseDrawnAprSource: 'manual' | 'live' =
      baseDrawnAprPrefilled && !dirtyFields.baseDrawnApr ? 'live' : 'manual';
    const result = setAaveV4DebtState(
      portfolioId,
      {
        drawnDebt: data.drawnDebt,
        premiumDebt: data.premiumDebt,
        baseDrawnApr: data.baseDrawnApr,
        riskPremium: data.riskPremium,
      },
      'manual',
      baseDrawnAprSource,
    );
    if (result.ok) {
      // Keeps the sync effect's own baseline in lockstep with what this
      // submit just wrote, and clears dirty state so a genuinely later
      // external change (e.g. `DebtPositionForm` applying a repayment)
      // can resync this form again — without this, `isDirty` would stay
      // permanently true after the first save and this form could never
      // resync again.
      lastSyncedV4DebtState.current = result.data.v4DebtState;
      reset({
        drawnDebt: data.drawnDebt,
        premiumDebt: data.premiumDebt,
        baseDrawnApr: toPercentInput(data.baseDrawnApr),
        riskPremium: toPercentInput(data.riskPremium),
      });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground">Debt assumptions</p>
      <label className="flex flex-col gap-1 text-sm">
        <span>
          Drawn debt <RequiredMark />
        </span>
        <input
          id="v4ManualDebtState.drawnDebt"
          aria-required="true"
          type="number"
          step="any"
          {...register('drawnDebt', { valueAsNumber: true })}
          aria-invalid={errors.drawnDebt ? 'true' : undefined}
          aria-describedby={errors.drawnDebt ? 'v4ManualDebtState.drawnDebt-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.drawnDebt && (
        <span id="v4ManualDebtState.drawnDebt-error" className="text-xs text-destructive">
          {errors.drawnDebt.message}
        </span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>
          Premium debt <RequiredMark />
        </span>
        <input
          id="v4ManualDebtState.premiumDebt"
          aria-required="true"
          type="number"
          step="any"
          {...register('premiumDebt', { valueAsNumber: true })}
          aria-invalid={errors.premiumDebt ? 'true' : undefined}
          aria-describedby={errors.premiumDebt ? 'v4ManualDebtState.premiumDebt-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.premiumDebt && (
        <span id="v4ManualDebtState.premiumDebt-error" className="text-xs text-destructive">
          {errors.premiumDebt.message}
        </span>
      )}

      <p role="status" className="text-xs text-muted-foreground">
        {baseDrawnAprHintText(
          baseDrawnRateStatus,
          baseDrawnAprPrefilled,
          Boolean(dirtyFields.baseDrawnApr),
        )}
      </p>
      <label className="flex flex-col gap-1 text-sm">
        <span>
          Base drawn APR (%) <RequiredMark />
        </span>
        <input
          id="v4ManualDebtState.baseDrawnApr"
          aria-required="true"
          type="number"
          step="any"
          {...register('baseDrawnApr', {
            setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
          })}
          aria-invalid={errors.baseDrawnApr ? 'true' : undefined}
          aria-describedby={
            errors.baseDrawnApr ? 'v4ManualDebtState.baseDrawnApr-error' : undefined
          }
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.baseDrawnApr && (
        <span id="v4ManualDebtState.baseDrawnApr-error" className="text-xs text-destructive">
          {errors.baseDrawnApr.message}
        </span>
      )}

      <label className="flex flex-col gap-1 text-sm">
        <span>
          Risk premium (%) <RequiredMark />
        </span>
        <input
          id="v4ManualDebtState.riskPremium"
          aria-required="true"
          type="number"
          step="any"
          {...register('riskPremium', {
            setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
          })}
          aria-invalid={errors.riskPremium ? 'true' : undefined}
          aria-describedby={errors.riskPremium ? 'v4ManualDebtState.riskPremium-error' : undefined}
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.riskPremium && (
        <span id="v4ManualDebtState.riskPremium-error" className="text-xs text-destructive">
          {errors.riskPremium.message}
        </span>
      )}

      <button
        type="submit"
        className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Save debt assumptions
      </button>
      {isSubmitSuccessful && (
        <span className="text-xs text-muted-foreground" role="status">
          Saved.
        </span>
      )}
    </form>
  );
}

function ManualCollateralFactorForm({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  const setAaveV4CollateralRisk = usePortfolioStore((state) => state.setAaveV4CollateralRisk);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitSuccessful, dirtyFields },
  } = useForm<
    ManualCollateralFactorFormValues,
    unknown,
    z.infer<typeof manualCollateralFactorSchema>
  >({
    resolver: zodResolver(manualCollateralFactorSchema),
    defaultValues: {
      collateralFactor: toPercentInput(portfolio.v4CollateralRisk?.collateralFactor) ?? 0,
    },
  });

  // BLOCKER #4 fix — same pattern as `ManualDebtStateForm` above.
  const isDirty = Boolean(dirtyFields.collateralFactor);
  const lastSyncedCollateralFactor = useRef(portfolio.v4CollateralRisk?.collateralFactor);

  useEffect(() => {
    if (isDirty) return;
    if (portfolio.v4CollateralRisk?.collateralFactor === lastSyncedCollateralFactor.current) {
      return;
    }
    reset({
      collateralFactor: toPercentInput(portfolio.v4CollateralRisk?.collateralFactor) ?? 0,
    });
    lastSyncedCollateralFactor.current = portfolio.v4CollateralRisk?.collateralFactor;
  }, [isDirty, portfolio.v4CollateralRisk?.collateralFactor, reset]);

  const onSubmit = handleSubmit((data) => {
    // `dynamicConfigKey: 0` — never a real on-chain key for a manual
    // entry, see this file's own header comment.
    const result = setAaveV4CollateralRisk(
      portfolioId,
      { collateralFactor: data.collateralFactor, dynamicConfigKey: 0 },
      'manual',
    );
    if (result.ok) {
      // See `ManualDebtStateForm`'s own identical comment above.
      lastSyncedCollateralFactor.current = result.data.v4CollateralRisk?.collateralFactor;
      reset({ collateralFactor: data.collateralFactor });
    }
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <p className="text-xs font-medium text-foreground">Collateral risk assumption</p>
      <label className="flex flex-col gap-1 text-sm">
        <span>
          Collateral factor (%) <RequiredMark />
        </span>
        <input
          id="v4ManualCollateralRisk.collateralFactor"
          aria-required="true"
          type="number"
          step="any"
          {...register('collateralFactor', {
            setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
          })}
          aria-invalid={errors.collateralFactor ? 'true' : undefined}
          aria-describedby={
            errors.collateralFactor ? 'v4ManualCollateralRisk.collateralFactor-error' : undefined
          }
          className="rounded-md border border-border bg-transparent px-3 py-2"
        />
      </label>
      {errors.collateralFactor && (
        <span
          id="v4ManualCollateralRisk.collateralFactor-error"
          className="text-xs text-destructive"
        >
          {errors.collateralFactor.message}
        </span>
      )}

      <button
        type="submit"
        className="self-start rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent/40"
      >
        Save collateral risk assumption
      </button>
      {isSubmitSuccessful && (
        <span className="text-xs text-muted-foreground" role="status">
          Saved.
        </span>
      )}
    </form>
  );
}

export function ManualAaveV4StateForm({
  portfolioId,
  portfolio,
}: {
  portfolioId: string;
  portfolio: Portfolio;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">
        No wallet? Enter your own assumptions instead — no address or live sync required.
        Calculations use these exactly like a live-synced value; nothing here is a V3 fallback.
      </p>
      <ManualDebtStateForm portfolioId={portfolioId} portfolio={portfolio} />
      <div className="border-t border-border pt-2">
        <ManualCollateralFactorForm portfolioId={portfolioId} portfolio={portfolio} />
      </div>
    </div>
  );
}

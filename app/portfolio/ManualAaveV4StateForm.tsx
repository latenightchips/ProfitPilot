'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

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
    formState: { errors, isSubmitSuccessful },
  } = useForm<ManualDebtStateFormValues, unknown, z.infer<typeof manualDebtStateSchema>>({
    resolver: zodResolver(manualDebtStateSchema),
    defaultValues: {
      drawnDebt: portfolio.v4DebtState?.drawnDebt ?? 0,
      premiumDebt: portfolio.v4DebtState?.premiumDebt ?? 0,
      baseDrawnApr: toPercentInput(portfolio.v4DebtState?.baseDrawnApr) ?? 0,
      riskPremium: toPercentInput(portfolio.v4DebtState?.riskPremium) ?? 0,
    },
  });

  const onSubmit = handleSubmit((data) => {
    setAaveV4DebtState(
      portfolioId,
      {
        drawnDebt: data.drawnDebt,
        premiumDebt: data.premiumDebt,
        baseDrawnApr: data.baseDrawnApr,
        riskPremium: data.riskPremium,
      },
      'manual',
    );
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
    formState: { errors, isSubmitSuccessful },
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

  const onSubmit = handleSubmit((data) => {
    // `dynamicConfigKey: 0` — never a real on-chain key for a manual
    // entry, see this file's own header comment.
    setAaveV4CollateralRisk(
      portfolioId,
      { collateralFactor: data.collateralFactor, dynamicConfigKey: 0 },
      'manual',
    );
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

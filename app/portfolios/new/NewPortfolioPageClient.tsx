'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { usePortfolioStore } from '@/stores/portfolioStore';
import { type PortfolioInput, portfolioInputSchema } from '@/types/portfolio.schema';

/**
 * `baseCurrency`'s `.default('USD')` in the schema gives `PortfolioInput`
 * (the schema's output/`z.infer` type) a required `baseCurrency`, but
 * React Hook Form's own field values before resolution follow the
 * schema's *input* type, where a defaulted field is optional — using
 * `PortfolioInput` directly for `useForm`'s generic mismatches what
 * `zodResolver` actually expects at that stage. `z.input<>` is the raw,
 * pre-default form-values shape; the resolver still produces
 * `PortfolioInput` (defaults applied) for `handleSubmit`'s callback via
 * react-hook-form's third (`TTransformedValues`) generic.
 */
type PortfolioFormValues = z.input<typeof portfolioInputSchema>;

/**
 * Portfolio Creation Flow — 06_TASKS.md M4-005 ("Implement Portfolio
 * Creation Flow"): "Create a guided portfolio setup flow." DoD: "A valid
 * portfolio is created, selected, calculated, and saved."
 *
 * Replaces the scaffold placeholder Batch 2 (M4-004) linked to.
 *
 * **"Guided," scoped as one organized form, not a multi-step wizard**:
 * the task text says "guided," not "multi-step" or "wizard," and no
 * wireframe anywhere in 03_UI.md breaks this flow into discrete steps
 * (only the high-level "Welcome Screen → Create Portfolio → Configure
 * Default Settings → Open Dashboard" flow exists, with no per-step
 * field allocation). Building step-state/progress-indicator machinery
 * beyond what's asked would be inventing UI architecture the
 * specification doesn't call for. This form still "guides" the user
 * through clearly labeled, logically ordered sections matching the
 * task's own "Collect" list order.
 *
 * **"Protocol parameters or preset" — manual entry only, no preset,
 * documented gap.** No numeric Aave V3 parameter values (a real-world
 * maxLTV/liquidationThreshold/borrowApr/supplyApr) are documented
 * anywhere in this specification — 04_BUILD_GUIDE.md's "PROTOCOL
 * SERVICE" section names the required *fields* but no values, and no
 * `AaveV3Provider` (the only place such values would legitimately come
 * from) has ever been built (see PROJECT_STATUS.md's Milestone 3
 * infrastructure-layer findings). Inventing a specific preset number
 * would mean fabricating real-world financial data the specification
 * never states. Only manual entry is offered.
 *
 * **"Saved" (DoD) means committed to the in-memory Portfolio Store**
 * (Conflict B, Milestone 4 plan) — `store.create()` is exactly this
 * batch's "save," not disk/cloud persistence, which remains Milestone
 * 8's job.
 *
 * Reuses `portfolioInputSchema` (M4-002) directly via `zodResolver` —
 * the same schema the Store's own `create()` re-validates against
 * (Batch 1), so a submission that passes here will also pass there.
 */
/**
 * 06_TASKS.md M9-026 ("Audit Form Accessibility") — "Required-field
 * identification." Visible `*` for sighted users (`aria-hidden`, purely
 * decorative — never announced on its own); the corresponding
 * `aria-required="true"` on each required field is the actual
 * screen-reader-facing signal. Deliberately not a plain sr-only text
 * node alongside the asterisk: any non-`aria-hidden` text inside a
 * `<label>` becomes part of that label's computed accessible name, which
 * would have silently broken every existing `getByLabelText('Portfolio
 * name')`-style query across this form's own unit tests (confirmed by
 * running them). Not the native `required` attribute either, deliberately:
 * this form's validation runs entirely through `zodResolver` on submit,
 * and native constraint validation would intercept submission with its
 * own browser-native error UI before React Hook Form's `handleSubmit`
 * ever runs, replacing this form's own existing Zod-message error spans
 * (and the e2e tests that assert their text) with browser-chrome no test
 * or design here accounts for.
 */
function RequiredMark() {
  return <span aria-hidden="true">*</span>;
}

/**
 * UX punch-list UX-01 — same percentage-scale UI boundary conversion as
 * `app/portfolio/PortfolioPageClient.tsx`'s identically-named helper.
 * `protocol.*` fields remain stored/validated as a 0–1 fraction; only the
 * text a user types into this form's number inputs is percentage-scale.
 */
function fromPercentInput(percent: number): number {
  return percent / 100;
}

const DEFAULT_VALUES: PortfolioFormValues = {
  name: '',
  description: undefined,
  baseCurrency: 'USD',
  collateral: { asset: 'BTC', quantity: 0 },
  debt: { asset: 'USDC', balance: 0 },
  market: { btcPriceUsd: 0 },
  protocol: { maxLoanToValue: 0, liquidationThreshold: 0, borrowApr: 0, supplyApr: 0 },
  settings: {},
};

export function NewPortfolioPageClient() {
  const router = useRouter();
  const create = usePortfolioStore((state) => state.create);
  const select = usePortfolioStore((state) => state.select);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<PortfolioFormValues, unknown, PortfolioInput>({
    resolver: zodResolver(portfolioInputSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const onSubmit = handleSubmit((data) => {
    const result = create(data);
    if (!result.ok) {
      setError('root', { message: result.errors.map((error) => error.message).join(' ') });
      return;
    }
    select(result.data.id);
    router.push('/portfolio');
  });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Create Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Enter your current position manually — no live price or protocol data is fetched.
        </p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Portfolio</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Portfolio name <RequiredMark />
            </span>
            <input
              id="name"
              aria-required="true"
              {...register('name')}
              aria-invalid={errors.name ? 'true' : undefined}
              aria-describedby={errors.name ? 'name-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.name && (
            <span id="name-error" className="text-xs text-destructive">
              {errors.name.message}
            </span>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Base currency <RequiredMark />
            </span>
            <input
              id="baseCurrency"
              aria-required="true"
              {...register('baseCurrency')}
              aria-invalid={errors.baseCurrency ? 'true' : undefined}
              aria-describedby={errors.baseCurrency ? 'baseCurrency-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.baseCurrency && (
            <span id="baseCurrency-error" className="text-xs text-destructive">
              {errors.baseCurrency.message}
            </span>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Collateral</legend>
          <input type="hidden" {...register('collateral.asset')} value="BTC" />
          <label className="flex flex-col gap-1 text-sm">
            <span>
              BTC quantity <RequiredMark />
            </span>
            <input
              id="collateral.quantity"
              aria-required="true"
              type="number"
              step="any"
              {...register('collateral.quantity', { valueAsNumber: true })}
              aria-invalid={errors.collateral?.quantity ? 'true' : undefined}
              aria-describedby={
                errors.collateral?.quantity ? 'collateral.quantity-error' : undefined
              }
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.collateral?.quantity && (
            <span id="collateral.quantity-error" className="text-xs text-destructive">
              {errors.collateral.quantity.message}
            </span>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Debt</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Debt asset <RequiredMark />
            </span>
            <select
              id="debt.asset"
              aria-required="true"
              {...register('debt.asset')}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Debt balance <RequiredMark />
            </span>
            <input
              id="debt.balance"
              aria-required="true"
              type="number"
              step="any"
              {...register('debt.balance', { valueAsNumber: true })}
              aria-invalid={errors.debt?.balance ? 'true' : undefined}
              aria-describedby={errors.debt?.balance ? 'debt.balance-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.debt?.balance && (
            <span id="debt.balance-error" className="text-xs text-destructive">
              {errors.debt.balance.message}
            </span>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Manual BTC price</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Current BTC price (USD) <RequiredMark />
            </span>
            <input
              id="market.btcPriceUsd"
              aria-required="true"
              type="number"
              step="any"
              {...register('market.btcPriceUsd', { valueAsNumber: true })}
              aria-invalid={errors.market?.btcPriceUsd ? 'true' : undefined}
              aria-describedby={errors.market?.btcPriceUsd ? 'market.btcPriceUsd-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.market?.btcPriceUsd && (
            <span id="market.btcPriceUsd-error" className="text-xs text-destructive">
              {errors.market.btcPriceUsd.message}
            </span>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">
            Protocol parameters (manual entry — no preset available)
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Maximum LTV (%) <RequiredMark />
            </span>
            <input
              id="protocol.maxLoanToValue"
              aria-required="true"
              type="number"
              step="any"
              {...register('protocol.maxLoanToValue', {
                setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
              })}
              aria-invalid={errors.protocol?.maxLoanToValue ? 'true' : undefined}
              aria-describedby={
                errors.protocol?.maxLoanToValue ? 'protocol.maxLoanToValue-error' : undefined
              }
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              The most you can borrow against your collateral, as a percentage (e.g. 75 for 75%).
            </span>
          </label>
          {errors.protocol?.maxLoanToValue && (
            <span id="protocol.maxLoanToValue-error" className="text-xs text-destructive">
              {errors.protocol.maxLoanToValue.message}
            </span>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Liquidation threshold (%) <RequiredMark />
            </span>
            <input
              id="protocol.liquidationThreshold"
              aria-required="true"
              type="number"
              step="any"
              {...register('protocol.liquidationThreshold', {
                setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
              })}
              aria-invalid={errors.protocol?.liquidationThreshold ? 'true' : undefined}
              aria-describedby={
                errors.protocol?.liquidationThreshold
                  ? 'protocol.liquidationThreshold-error'
                  : undefined
              }
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              The LTV at which your position becomes eligible for liquidation, as a percentage.
            </span>
          </label>
          {errors.protocol?.liquidationThreshold && (
            <span id="protocol.liquidationThreshold-error" className="text-xs text-destructive">
              {errors.protocol.liquidationThreshold.message}
            </span>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Borrow APR (%) <RequiredMark />
            </span>
            <input
              id="protocol.borrowApr"
              aria-required="true"
              type="number"
              step="any"
              {...register('protocol.borrowApr', {
                setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
              })}
              aria-invalid={errors.protocol?.borrowApr ? 'true' : undefined}
              aria-describedby={errors.protocol?.borrowApr ? 'protocol.borrowApr-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              Your annual borrow interest rate, as a percentage (e.g. 5 for 5%).
            </span>
          </label>
          {errors.protocol?.borrowApr && (
            <span id="protocol.borrowApr-error" className="text-xs text-destructive">
              {errors.protocol.borrowApr.message}
            </span>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span>
              Supply APR (%) <RequiredMark />
            </span>
            <input
              id="protocol.supplyApr"
              aria-required="true"
              type="number"
              step="any"
              {...register('protocol.supplyApr', {
                setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
              })}
              aria-invalid={errors.protocol?.supplyApr ? 'true' : undefined}
              aria-describedby={errors.protocol?.supplyApr ? 'protocol.supplyApr-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            <span className="text-xs text-muted-foreground">
              Your annual supply interest rate, as a percentage.
            </span>
          </label>
          {errors.protocol?.supplyApr && (
            <span id="protocol.supplyApr-error" className="text-xs text-destructive">
              {errors.protocol.supplyApr.message}
            </span>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Optional safety targets</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>Target Health Factor</span>
            <input
              type="number"
              step="any"
              {...register('settings.safetyTargets.targetHealthFactor', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Holding period (days)</span>
            <input
              type="number"
              step="any"
              {...register('settings.safetyTargets.holdingPeriodDays', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Target BTC price (USD)</span>
            <input
              type="number"
              step="any"
              {...register('settings.safetyTargets.targetBtcPriceUsd', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Safety buffer (%)</span>
            <input
              type="number"
              step="any"
              {...register('settings.safetyTargets.safetyBufferPercent', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
        </fieldset>

        {/* Execution cost assumptions — V4 Readiness Audit §12 P1-6. See
            `PortfolioPageClient.tsx`'s identical fieldset for the full
            reasoning (decimal-fraction entry, no percent conversion,
            each field independently optional). Optional here too — a
            portfolio can be created without them and configured later on
            the Portfolio Details page. */}
        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">
            Optional execution cost assumptions
          </legend>
          <p className="text-xs text-muted-foreground">
            Planning assumptions, not live market quotes — used by Loop Builder and Exit Planner to
            estimate transaction costs.
          </p>
          <label className="flex flex-col gap-1 text-sm">
            <span>Swap fee assumption (decimal, e.g. 0.003 for 0.3%)</span>
            <input
              type="number"
              step="any"
              min="0"
              max="0.999999"
              {...register('settings.executionCostAssumptions.swapFeeRate', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Slippage assumption (decimal, e.g. 0.005 for 0.5%)</span>
            <input
              type="number"
              step="any"
              min="0"
              max="0.999999"
              {...register('settings.executionCostAssumptions.slippageRate', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Gas cost assumption (USD per transaction)</span>
            <input
              type="number"
              step="any"
              min="0"
              {...register('settings.executionCostAssumptions.gasCostUsd', {
                setValueAs: (value) => (value === '' ? undefined : Number(value)),
              })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
        </fieldset>

        {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          Create Portfolio
        </button>
      </form>
    </div>
  );
}

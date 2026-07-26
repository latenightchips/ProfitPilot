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

export default function NewPortfolioPage() {
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
            <span>Portfolio name</span>
            <input
              {...register('name')}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            {errors.name && <span className="text-xs text-destructive">{errors.name.message}</span>}
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Base currency</span>
            <input
              {...register('baseCurrency')}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            {errors.baseCurrency && (
              <span className="text-xs text-destructive">{errors.baseCurrency.message}</span>
            )}
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Collateral</legend>
          <input type="hidden" {...register('collateral.asset')} value="BTC" />
          <label className="flex flex-col gap-1 text-sm">
            <span>BTC quantity</span>
            <input
              type="number"
              step="any"
              {...register('collateral.quantity', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            {errors.collateral?.quantity && (
              <span className="text-xs text-destructive">{errors.collateral.quantity.message}</span>
            )}
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Debt</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>Debt asset</span>
            <select
              {...register('debt.asset')}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            >
              <option value="USDC">USDC</option>
              <option value="USDT">USDT</option>
              <option value="DAI">DAI</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Debt balance</span>
            <input
              type="number"
              step="any"
              {...register('debt.balance', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            {errors.debt?.balance && (
              <span className="text-xs text-destructive">{errors.debt.balance.message}</span>
            )}
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Manual BTC price</legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>Current BTC price (USD)</span>
            <input
              type="number"
              step="any"
              {...register('market.btcPriceUsd', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
            {errors.market?.btcPriceUsd && (
              <span className="text-xs text-destructive">{errors.market.btcPriceUsd.message}</span>
            )}
          </label>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">
            Protocol parameters (manual entry — no preset available)
          </legend>
          <label className="flex flex-col gap-1 text-sm">
            <span>Maximum LTV (0–1)</span>
            <input
              type="number"
              step="any"
              {...register('protocol.maxLoanToValue', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Liquidation threshold (0–1)</span>
            <input
              type="number"
              step="any"
              {...register('protocol.liquidationThreshold', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Borrow APR (0–1)</span>
            <input
              type="number"
              step="any"
              {...register('protocol.borrowApr', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Supply APR (0–1)</span>
            <input
              type="number"
              step="any"
              {...register('protocol.supplyApr', { valueAsNumber: true })}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.protocol?.maxLoanToValue && (
            <span className="text-xs text-destructive">
              {errors.protocol.maxLoanToValue.message}
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

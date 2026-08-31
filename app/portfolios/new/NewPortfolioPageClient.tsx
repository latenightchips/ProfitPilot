'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { type PortfolioInput, portfolioInputSchema } from '@/types/portfolio.schema';
import { deriveAaveDataStatus, formatAaveDataStatus } from '@/utils/aaveDataStatus';

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
 * **"Protocol parameters or preset" — was manual entry only; now live
 * bootstrap, still no fabricated preset (V3 New-Portfolio Live
 * Bootstrap).** No numeric Aave V3 parameter values (a real-world
 * maxLTV/liquidationThreshold/borrowApr/supplyApr) are documented
 * anywhere in this specification, so this form never hardcodes one — but
 * `infrastructure/protocols/aave/v3` (built well after this comment was
 * first written) now provides a real, live one via the same
 * `stores/aaveLiveDataStore.ts` every other page already uses. This form
 * reuses that store directly — no duplicate fetch logic — to prefill
 * BTC price and the four protocol fields the moment a real value is
 * available, always still editable, always falling back to today's
 * manual-entry behavior (including submission) when it isn't. See the
 * "Live bootstrap" section below for the full design.
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

/**
 * V3 New-Portfolio Live Bootstrap — production smoke-test finding. This
 * form previously always started BTC price and every protocol field at
 * `0` and offered manual entry as the only path, even though
 * `stores/aaveLiveDataStore.ts` (built well after this form, for
 * `hooks/useAaveLiveSync.ts`'s post-creation sync) already provides
 * exactly this data with zero configuration (a public RPC fallback —
 * see that store's own header comment). **Reuses that store directly —
 * `fetchLiveAaveData(debtAsset)` is the one and only fetch call, no
 * duplicate Aave-fetch logic written here.**
 *
 * **Not `hooks/useAaveLiveSync.ts` itself** — deliberately. That hook is
 * portfolio-scoped (it reads/writes `portfolios[portfolioId]`, which
 * cannot exist before creation) and owns the *post-creation*
 * manual-vs-live conflict-confirmation model. This form only needs the
 * portfolio-independent fetch layer underneath it.
 *
 * **Prefill, never overwrite.** `setValue(..., { shouldDirty: false })`
 * only ever targets a field the user has not yet touched
 * (`formState.dirtyFields`, checked per field before every prefill call)
 * — a field the user is already typing into, or has already edited, is
 * never clobbered by a landing fetch, on mount or after a debt-asset
 * change. `shouldDirty: false` is also what keeps a successful,
 * untouched prefill distinguishable from a real edit at submit time:
 * RHF computes `dirtyFields` by comparing against `DEFAULT_VALUES`
 * (`0` for every numeric field here), and a prefill that opts out of
 * that comparison never marks the field dirty on its own.
 *
 * **Provenance, tracked independently, decided only at submit time.**
 * `marketPrefilled`/`protocolPrefilled` record whether a real live value
 * was EVER successfully written into that group's field(s) this session
 * — necessary because "not dirty" alone is ambiguous (it's also true of
 * a field still sitting at its original `0` because live data never
 * arrived). At submit: a group counts as `'live'` only if it was
 * prefilled AND is still not dirty; any edit to even one of the four
 * protocol fields marks the whole `protocol` group `'manual'` (the same
 * atomic-unit treatment `Portfolio.protocolSource` already gives it
 * everywhere else in this codebase — `hooks/useAaveLiveSync.ts`,
 * `app/portfolio/AaveV3ConflictConfirmation.tsx`). `market` and
 * `protocol` are otherwise fully independent — editing BTC price alone
 * never affects `protocolSource`, and vice versa.
 *
 * **Race protection is entirely inherited, not reimplemented.**
 * `aaveLiveDataStore.fetchLiveAaveData`'s own monotonic request-id guard
 * already discards a stale response if the debt asset changes again
 * before an in-flight fetch resolves — the same protection every other
 * live-sync caller in this codebase already relies on. This form adds
 * one more defensive check on top, mirroring `useAaveLiveSync`'s own
 * identical guard verbatim: a landed `protocolQuote` is only prefilled
 * if its own `borrowAsset` still matches the form's *currently selected*
 * debt asset (`watch('debt.asset')`), never a value that was true when
 * the request was fired.
 *
 * **Failure is silent and honest, never blocking.** `aaveLiveDataStore`'s
 * own error path leaves `marketQuote`/`protocolQuote` at `null` (nothing
 * to prefill from) without throwing; this form's own status line
 * (`liveBootstrapStatusText` below) says so in plain language rather
 * than ever claiming a manually-entered `0` default is live. Nothing
 * about submission is gated on live data succeeding — today's manual-only
 * validation (BTC price must be positive, etc.) is completely unchanged.
 *
 * **V4 is untouched.** This form has never had a `protocolVersion`
 * field — every portfolio it creates is V3-shaped, exactly as before;
 * V4 is opted into afterward, on the Portfolio page, via a real on-chain
 * address. None of `hooks/useAaveV4LiveSync.ts`,
 * `hooks/useAaveV4CollateralRiskLiveSync.ts`, or their own conflict UI
 * are reachable from, or modified by, this file.
 */
function liveBootstrapStatusText(
  status: ReturnType<typeof useAaveLiveDataStore.getState>['status'],
  marketQuote: ReturnType<typeof useAaveLiveDataStore.getState>['marketQuote'],
): string {
  if (status === 'idle' || status === 'loading') {
    return 'Checking for live Aave V3 data…';
  }
  if (status === 'error') {
    return 'Live Aave V3 data is unavailable right now — enter values manually below.';
  }
  // status === 'ready'
  return formatAaveDataStatus(deriveAaveDataStatus(marketQuote));
}

export function NewPortfolioPageClient() {
  const router = useRouter();
  const create = usePortfolioStore((state) => state.create);
  const select = usePortfolioStore((state) => state.select);

  const liveStatus = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const protocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);

  const [marketPrefilled, setMarketPrefilled] = useState(false);
  const [protocolPrefilled, setProtocolPrefilled] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
    setError,
  } = useForm<PortfolioFormValues, unknown, PortfolioInput>({
    resolver: zodResolver(portfolioInputSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const debtAsset = watch('debt.asset');

  // Fetch on initial load and whenever the selected debt asset changes —
  // `fetchLiveAaveData`'s own request-id guard (`aaveLiveDataStore.ts`)
  // makes a rapid asset switch safe without any coordination here.
  useEffect(() => {
    void fetchLiveAaveData(debtAsset);
  }, [fetchLiveAaveData, debtAsset]);

  // Prefill only fields the user has not yet touched. Runs whenever a
  // fresh quote lands (including a re-fetch after a debt-asset change).
  useEffect(() => {
    if (liveStatus !== 'ready') return;

    if (marketQuote !== null && marketQuote.freshness !== 'unavailable') {
      if (!dirtyFields.market?.btcPriceUsd) {
        setValue('market.btcPriceUsd', marketQuote.price, { shouldDirty: false });
      }
      setMarketPrefilled(true);
    }

    if (
      protocolQuote !== null &&
      protocolQuote.available &&
      protocolQuote.borrowAsset === debtAsset
    ) {
      const { maxLoanToValue, liquidationThreshold, borrowApr, supplyApr } =
        protocolQuote.parameters;
      if (!dirtyFields.protocol?.maxLoanToValue) {
        setValue('protocol.maxLoanToValue', maxLoanToValue * 100, { shouldDirty: false });
      }
      if (!dirtyFields.protocol?.liquidationThreshold) {
        setValue('protocol.liquidationThreshold', liquidationThreshold * 100, {
          shouldDirty: false,
        });
      }
      if (!dirtyFields.protocol?.borrowApr) {
        setValue('protocol.borrowApr', borrowApr * 100, { shouldDirty: false });
      }
      if (!dirtyFields.protocol?.supplyApr) {
        setValue('protocol.supplyApr', supplyApr * 100, { shouldDirty: false });
      }
      setProtocolPrefilled(true);
    }
  }, [liveStatus, marketQuote, protocolQuote, debtAsset, dirtyFields, setValue]);

  const onSubmit = handleSubmit((data) => {
    const marketSource = marketPrefilled && !dirtyFields.market?.btcPriceUsd ? 'live' : 'manual';
    const protocolFieldsDirty =
      dirtyFields.protocol?.maxLoanToValue ||
      dirtyFields.protocol?.liquidationThreshold ||
      dirtyFields.protocol?.borrowApr ||
      dirtyFields.protocol?.supplyApr;
    const protocolSource = protocolPrefilled && !protocolFieldsDirty ? 'live' : 'manual';

    const result = create(data, { marketSource, protocolSource });
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
          Enter your collateral and debt manually. BTC price and Aave V3 protocol parameters are
          prefilled from live data when available — every value stays editable, and you can enter
          everything by hand if live data is unavailable.
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
          <legend className="text-sm font-semibold text-foreground">BTC price</legend>
          <p role="status" className="text-xs text-muted-foreground">
            {liveBootstrapStatusText(liveStatus, marketQuote)}
          </p>
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
          <legend className="text-sm font-semibold text-foreground">Protocol parameters</legend>
          <p className="text-xs text-muted-foreground">
            {liveBootstrapStatusText(liveStatus, marketQuote)}
          </p>
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

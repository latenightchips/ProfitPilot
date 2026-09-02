'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import type { AaveProtocolVersion } from '@/services';
import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';
import { useAaveV4ReservePriceStore } from '@/stores/aaveV4ReservePriceStore';
import { usePortfolioStore } from '@/stores/portfolioStore';
import { type PortfolioInput, portfolioInputSchema } from '@/types/portfolio.schema';
import { deriveAaveDataStatus, formatAaveDataStatus } from '@/utils/aaveDataStatus';

import { NewPortfolioV4Fields, type NewPortfolioV4FieldsHandle } from './NewPortfolioV4Fields';

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
 * **V4 selection (Protocol Selection at Portfolio Creation batch).**
 * This form now has a `protocolVersion` selector, mirroring
 * `app/portfolio/AaveProtocolVersionForm.tsx`'s own existing edit-time
 * radiogroup exactly — same two options, same "select V3, nothing about
 * V4 state changes" discipline. When V4 is selected, this file hides the
 * V3-only `protocol.*` fieldset (never meaningful for V4 —
 * `services/portfolio/mapping.ts`'s `resolveRiskCapacityFraction` never
 * reads it once `v4CollateralRisk` is present) and renders
 * `NewPortfolioV4Fields` — a separate, self-contained fieldset that
 * reuses the same portfolio-independent `aaveV4LiveDataStore`/
 * `aaveV4CollateralRiskLiveDataStore` this form's own V3 half already
 * demonstrated the pattern for. `market.btcPriceUsd` remains the one
 * field genuinely shared between both versions.
 *
 * **V4 BTC price is wallet-address-independent (V4 wallet-independent
 * price fix).** Originally this form sourced V4's `market.btcPriceUsd`
 * from the address-GATED `aaveV4CollateralRiskLiveDataStore`'s own
 * `collateralPriceUsd` — meaning V4 creation showed no live price at all
 * until an on-chain address was typed, even though
 * `infrastructure/protocols/aave/v4`'s `ISpoke.ORACLE()` →
 * `IPriceOracle.getReservePrice(reserveId)` reads never actually
 * depended on a user address; only `collateralFactor` (via
 * `getUserPosition`/`getDynamicReserveConfig`) does. This form now
 * fetches that address-independent price directly via the new
 * `aaveV4ReservePriceStore`/`fetchAaveV4ReservePrice()`
 * (`/api/aave/v4-reserve-price`, no query params), unconditionally the
 * moment V4 is selected — never V3's `AaveOracle` price, which reads a
 * different contract entirely and is never used as a V4 fallback. The
 * address-gated `aaveV4CollateralRiskLiveDataStore` is unchanged and
 * still supplies `collateralFactor`/`dynamicConfigKey` (inside
 * `NewPortfolioV4Fields`) once an address is entered — wallet identity
 * stays required for V4 position/debt/collateral-risk data only.
 *
 * **Submission still calls `usePortfolioStore().create()` exactly
 * once**, in both modes — no parallel V4-shaped creation path. For V4,
 * `protocol.*` is submitted as a fixed, inert placeholder
 * (`{ maxLoanToValue: 0, liquidationThreshold: 0, borrowApr: 0,
 * supplyApr: 0 }`, `protocolSource: 'manual'`) never shown to the user,
 * and the returned portfolio id is fed into the exact same
 * `setProtocolVersion`/`setAaveV4Position`/`setAaveV4DebtState`/
 * `setAaveV4CollateralRisk` actions `AaveProtocolVersionForm`/
 * `ManualAaveV4StateForm` already call at edit time — reused verbatim,
 * not reimplemented, so V4 semantics can never drift between
 * creation-time and edit-time. `NewPortfolioV4Fields`'s own
 * `prepareSubmission()` pre-validates every touched V4 section before
 * this function ever calls `create()`, so an invalid V4 entry never
 * leaves a partially configured portfolio behind.
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

/**
 * V4 wallet-independent price fix — mirrors `liveBootstrapStatusText`
 * above but for `aaveV4ReservePriceStore`, which has no per-asset
 * `marketQuote`-style freshness shape of its own (a single-value V4
 * on-chain snapshot, same as `aaveV4CollateralRiskLiveDataStore`'s own
 * status text convention).
 */
function v4ReservePriceStatusText(
  status: ReturnType<typeof useAaveV4ReservePriceStore.getState>['status'],
): string {
  if (status === 'idle' || status === 'loading') {
    return 'Checking for live Aave V4 collateral price…';
  }
  if (status === 'error') {
    return 'Live Aave V4 price data is unavailable right now — enter a value manually below.';
  }
  // status === 'ready'
  return 'Aave V4 · Live collateral price found — value below is pre-filled and still editable.';
}

export function NewPortfolioPageClient() {
  const router = useRouter();
  const create = usePortfolioStore((state) => state.create);
  const select = usePortfolioStore((state) => state.select);
  const setProtocolVersion = usePortfolioStore((state) => state.setProtocolVersion);
  const setAaveV4Position = usePortfolioStore((state) => state.setAaveV4Position);
  const setAaveV4DebtState = usePortfolioStore((state) => state.setAaveV4DebtState);
  const setAaveV4CollateralRisk = usePortfolioStore((state) => state.setAaveV4CollateralRisk);

  const liveStatus = useAaveLiveDataStore((state) => state.status);
  const marketQuote = useAaveLiveDataStore((state) => state.marketQuote);
  const protocolQuote = useAaveLiveDataStore((state) => state.protocolQuote);
  const fetchLiveAaveData = useAaveLiveDataStore((state) => state.fetchLiveAaveData);

  const v4ReservePriceStatus = useAaveV4ReservePriceStore((state) => state.status);
  const v4ReservePriceCanonical = useAaveV4ReservePriceStore((state) => state.canonical);
  const fetchAaveV4ReservePrice = useAaveV4ReservePriceStore(
    (state) => state.fetchAaveV4ReservePrice,
  );

  const [protocolVersion, setProtocolVersionField] = useState<AaveProtocolVersion>('v3');
  const [marketPrefilled, setMarketPrefilled] = useState(false);
  const [protocolPrefilled, setProtocolPrefilled] = useState(false);
  const v4FieldsRef = useRef<NewPortfolioV4FieldsHandle>(null);

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

  // Reset-on-toggle — declared FIRST and deliberately runs before either
  // version's prefill effect below in the same commit (React runs
  // `useEffect` callbacks in declaration order): `market.btcPriceUsd` is
  // the one field genuinely shared between V3 and V4, but its *source*
  // differs (V3's reserve fetch vs. V4's collateral-risk fetch). An
  // untouched prefilled value from the version just left behind would
  // otherwise silently survive and could be misattributed to the newly
  // selected version's source at submit time — "switching protocol
  // versions cannot leak stale values." A genuinely manually-typed value
  // (dirty) is left alone: its meaning (BTC's dollar price) does not
  // depend on protocol version, so it is not "stale," and it is never
  // labeled `live` for either version without a fresh, matching fetch
  // confirming it. Running before the version-specific prefill effects
  // (not after) matters: both react to the same `protocolVersion`
  // change in the same commit, so a reset that ran *after* a same-commit
  // prefill would immediately clobber it back to zero.
  //
  // Entering V4 also force-resets `protocol.*` (always, dirty or not —
  // the fieldset is hidden and un-editable for the entire time V4 stays
  // selected, so there is no in-progress edit to protect) to the same
  // fixed placeholder `onSubmit` itself would substitute anyway. Without
  // this, a value the user typed in V3 mode that happens to violate
  // `protocolParametersSchema`'s own invariant (e.g. Max LTV set above
  // Liquidation Threshold) would silently fail the V4 submission's own
  // `zodResolver` validation against an error the V4 user can never see
  // or fix, since the fieldset producing it is hidden. Re-entering V3
  // needs no symmetric reset: the V3 prefill effect below already
  // re-populates `protocol.*` the moment `protocolVersion` reads `'v3'`
  // again, from whatever `aaveLiveDataStore` already has cached.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!dirtyFields.market?.btcPriceUsd) {
      setValue('market.btcPriceUsd', 0, { shouldDirty: false });
    }
    setMarketPrefilled(false);
    setProtocolPrefilled(false);
    if (protocolVersion === 'v4') {
      setValue('protocol.maxLoanToValue', 0, { shouldDirty: false });
      setValue('protocol.liquidationThreshold', 0, { shouldDirty: false });
      setValue('protocol.borrowApr', 0, { shouldDirty: false });
      setValue('protocol.supplyApr', 0, { shouldDirty: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolVersion]);

  // V3 fetch — on initial load and whenever the selected debt asset
  // changes, only while V3 is selected. `fetchLiveAaveData`'s own
  // request-id guard (`aaveLiveDataStore.ts`) makes a rapid asset switch
  // safe without any coordination here.
  useEffect(() => {
    if (protocolVersion !== 'v3') return;
    void fetchLiveAaveData(debtAsset);
  }, [protocolVersion, fetchLiveAaveData, debtAsset]);

  // Prefill only fields the user has not yet touched. Runs whenever a
  // fresh quote lands (including a re-fetch after a debt-asset change).
  useEffect(() => {
    if (protocolVersion !== 'v3') return;
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
  }, [protocolVersion, liveStatus, marketQuote, protocolQuote, debtAsset, dirtyFields, setValue]);

  // V4 reserve-price fetch — unconditional the moment V4 is selected,
  // independent of any wallet address (V4 wallet-independent price fix).
  // No identity dimension to key on (unlike the V3 fetch's own
  // `debtAsset` dependency) — the collateral reserve's oracle price is a
  // property of the Spoke/reserve alone, so this fires exactly once per
  // V4 selection, never re-fires on its own for any other reason.
  useEffect(() => {
    if (protocolVersion !== 'v4') return;
    void fetchAaveV4ReservePrice();
  }, [protocolVersion, fetchAaveV4ReservePrice]);

  // V4's shared `market.btcPriceUsd` prefill — sourced from the
  // wallet-address-independent `aaveV4ReservePriceStore` above, never
  // the address-gated `aaveV4CollateralRiskLiveDataStore` (that store's
  // own `collateralPriceUsd` field stays unused here by design — see
  // this file's own header comment).
  useEffect(() => {
    if (protocolVersion !== 'v4') return;
    if (v4ReservePriceStatus !== 'ready' || v4ReservePriceCanonical === null) return;
    if (!dirtyFields.market?.btcPriceUsd) {
      setValue('market.btcPriceUsd', v4ReservePriceCanonical.collateralPriceUsd, {
        shouldDirty: false,
      });
    }
    setMarketPrefilled(true);
  }, [
    protocolVersion,
    v4ReservePriceStatus,
    v4ReservePriceCanonical,
    dirtyFields.market?.btcPriceUsd,
    setValue,
  ]);

  const onSubmit = handleSubmit((data) => {
    if (protocolVersion === 'v4') {
      const v4Submission = v4FieldsRef.current?.prepareSubmission();
      if (v4Submission === undefined || !v4Submission.ok) {
        return;
      }

      const marketSource = marketPrefilled && !dirtyFields.market?.btcPriceUsd ? 'live' : 'manual';
      // V4 Manual-Data / Provenance Audit — "hide-and-compute": canonical
      // V4 total debt is always `drawnDebt + premiumDebt` from the V4
      // fieldset's own validated submission, never the shared legacy
      // `data.debt.balance` field (hidden for V4 above, so it never
      // reflects independent user input here regardless of whatever
      // stale/default value it happens to carry). `0` when the debt
      // section was never touched, matching the existing fail-closed
      // "untouched V4 debt state stays undefined" convention.
      const canonicalDebtBalance =
        v4Submission.debtState !== undefined
          ? v4Submission.debtState.drawnDebt + v4Submission.debtState.premiumDebt
          : 0;
      const v4Data: PortfolioInput = {
        ...data,
        debt: { ...data.debt, balance: canonicalDebtBalance },
        // V4-only creation: `protocol.*` has no V4 meaning
        // (`resolveRiskCapacityFraction` never reads it once
        // `v4CollateralRisk` is present) — a fixed, inert placeholder,
        // never derived from whatever might be left in the hidden V3
        // fieldset, and never shown to the user.
        protocol: { maxLoanToValue: 0, liquidationThreshold: 0, borrowApr: 0, supplyApr: 0 },
      };

      const result = create(v4Data, { marketSource, protocolSource: 'manual' });
      if (!result.ok) {
        setError('root', { message: result.errors.map((error) => error.message).join(' ') });
        return;
      }

      const id = result.data.id;
      setProtocolVersion(id, 'v4');
      if (v4Submission.position !== undefined) {
        setAaveV4Position(id, v4Submission.position);
      }
      if (v4Submission.debtState !== undefined) {
        setAaveV4DebtState(id, v4Submission.debtState, v4Submission.debtStateSource);
      }
      if (v4Submission.collateralRisk !== undefined) {
        setAaveV4CollateralRisk(id, v4Submission.collateralRisk, v4Submission.collateralRiskSource);
      }

      select(id);
      router.push('/portfolio');
      return;
    }

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
          Enter your collateral and debt manually, then choose which Aave protocol version this
          portfolio uses. Market and protocol values are prefilled from live data when available —
          every value stays editable, and you can enter everything by hand if live data is
          unavailable.
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
          {protocolVersion === 'v3' && (
            <>
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
            </>
          )}
          {protocolVersion === 'v4' && (
            // V4 Manual-Data / Provenance Audit — "hide-and-compute": V4
            // has no independently-editable "Debt balance" field. Total
            // debt is always `drawnDebt + premiumDebt`, computed at
            // submit time from the Aave V4 fieldset below (which shows
            // its own read-only running total) — never a second,
            // separately-typed number that could disagree with it.
            <p className="text-xs text-muted-foreground">
              Aave V4 debt balance is calculated from drawn debt + premium debt, entered in the Aave
              V4 fieldset below — not entered here.
            </p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">Aave protocol version</legend>
          <div
            role="radiogroup"
            aria-label="Aave protocol version"
            className="flex flex-col gap-2 text-sm"
          >
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="protocolVersion"
                value="v3"
                checked={protocolVersion === 'v3'}
                onChange={() => setProtocolVersionField('v3')}
              />
              Aave V3
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="protocolVersion"
                value="v4"
                checked={protocolVersion === 'v4'}
                onChange={() => setProtocolVersionField('v4')}
              />
              Aave V4
            </label>
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="text-sm font-semibold text-foreground">BTC price</legend>
          <p role="status" className="text-xs text-muted-foreground">
            {protocolVersion === 'v3'
              ? liveBootstrapStatusText(liveStatus, marketQuote)
              : v4ReservePriceStatusText(v4ReservePriceStatus)}
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

        {protocolVersion === 'v4' && (
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-foreground">
              Aave V4 debt &amp; collateral risk
            </legend>
            <NewPortfolioV4Fields ref={v4FieldsRef} debtAsset={debtAsset} />
          </fieldset>
        )}

        {protocolVersion === 'v3' && (
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
                aria-describedby={
                  errors.protocol?.borrowApr ? 'protocol.borrowApr-error' : undefined
                }
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
                aria-describedby={
                  errors.protocol?.supplyApr ? 'protocol.supplyApr-error' : undefined
                }
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
        )}

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

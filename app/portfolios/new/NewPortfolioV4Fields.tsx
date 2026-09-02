'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';

import type { AaveV4DataSource } from '@/services';
import { useAaveV4BaseDrawnRateStore } from '@/stores/aaveV4BaseDrawnRateStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import {
  aaveV4CollateralRiskConfigSchema,
  aaveV4DebtStateSchema,
  aaveV4PositionIdentitySchema,
} from '@/types/portfolio.schema';
import { hasEvmAddressShape } from '@/utils/evmAddress';

/**
 * V4 creation-time fieldset — Protocol Selection at Portfolio Creation
 * batch. Extracted into its own file per the batch's own instruction
 * ("Extract the V4 creation fieldset into a focused child component
 * rather than further bloating `NewPortfolioPageClient.tsx`") and, per
 * the audit's corrected finding, mirrors the semantics `app/portfolio/
 * AaveProtocolVersionForm.tsx` (address + live sync) and `app/portfolio/
 * ManualAaveV4StateForm.tsx` (manual debt/collateral-risk entry) already
 * establish at edit time — this is the same experience, moved earlier,
 * not a reinvented one. Same percent-scale (`baseDrawnApr`/`riskPremium`/
 * `collateralFactor`) and `dynamicConfigKey: 0`-for-manual conventions
 * those two components already use.
 *
 * **A separate, self-contained `useForm()` — not the parent's own
 * form.** Mirrors this codebase's own established convention (every V4
 * edit-time component already uses its own independent `useForm()`
 * rather than sharing one with sibling forms — see
 * `ManualAaveV4StateForm.tsx`'s own header comment on "two independent
 * sub-forms"). Rendered as plain fields inside the parent's outer
 * `<form>` (no nested `<form>` element — invalid HTML, and unnecessary:
 * React Hook Form's own `handleSubmit` never reads native DOM `FormData`,
 * only its own instance's registered fields, so this component's inputs
 * cannot be misread by the parent's `handleSubmit` or vice versa).
 *
 * **Reuses the existing portfolio-independent V4 live-data stores
 * directly** (`aaveV4LiveDataStore`/`aaveV4CollateralRiskLiveDataStore`),
 * never the portfolio-*scoped* sync hooks (`useAaveV4LiveSync`/
 * `useAaveV4CollateralRiskLiveSync`), which require an existing
 * portfolio ID that does not exist yet at creation time — the same
 * "reuse the store layer, not the portfolio-scoped consumer" pattern
 * `NewPortfolioPageClient.tsx`'s own V3 live bootstrap already
 * established for `aaveLiveDataStore`.
 *
 * **Fetch only fires once the typed address has a valid EVM shape**
 * (`hasEvmAddressShape`, format only — checksum is validated separately
 * at submit time via `aaveV4PositionIdentitySchema`, the same two-stage
 * split `types/portfolio.schema.ts`'s own header comment documents for
 * `hasEvmAddressShape`/`isValidEip55Address`) — this avoids firing an RPC
 * call on every keystroke of a still-incomplete address, matching "must
 * remain usable without dedicated RPC configuration" by not spamming the
 * public fallback RPC for input that cannot possibly resolve yet.
 *
 * **Collateral-risk fetch keys only on address; debt-state fetch keys on
 * address AND debt asset** — mirrors `aaveV4CollateralRiskLiveDataStore`'s
 * own header comment ("keyed by `userAddress` alone... collateral risk
 * always resolves the same fixed collateral asset") and
 * `aaveV4LiveDataStore`'s own ("keyed by identity (`userAddress` +
 * `debtAsset`)... the debt reserve genuinely depends on which stablecoin
 * the portfolio borrows"). A debt-asset change therefore re-fetches only
 * the debt-state half, never the collateral-risk half — exactly the
 * batch's own "Debt-asset changes should re-fetch only the appropriate
 * V4 debt-state data" requirement, inherited for free from each store's
 * own existing identity model rather than re-implemented here.
 *
 * **Prefill, never overwrite** — same `dirtyFields`-gated,
 * `shouldDirty: false` `setValue` discipline as the V3 live bootstrap,
 * and the same identity-mismatch guard `useAaveLiveSync`'s
 * `protocolQuote.borrowAsset === debtAsset` check already established
 * (here: the store's own recorded `userAddress`/`debtAsset` must match
 * what is currently typed/selected before a landed response is trusted
 * for prefill — a stale response for an address or asset the user has
 * since changed away from is silently ignored, never displayed).
 *
 * **`debtStatePrefilled`/`collateralRiskPrefilled` track "was this
 * section EVER successfully live-populated," independently** — same
 * reasoning as `NewPortfolioPageClient.tsx`'s own `marketPrefilled`/
 * `protocolPrefilled`: "not dirty" alone cannot distinguish a field that
 * is honestly untouched-at-zero from one that was live-prefilled and
 * never edited.
 *
 * **"Touched" gates whether a section is submitted at all — the
 * fail-closed-preservation mechanism.** Unlike V3's `market`/`protocol`
 * (always schema-required, so the form always submits *something* for
 * them), V4's `v4DebtState`/`v4CollateralRisk` are optional on
 * `ApplicationPortfolio`, and `services/portfolio/mapping.ts`'s
 * `checkAaveV4DebtStateAvailable`/`checkAaveV4CollateralRiskAvailable`
 * deliberately fail every calculation closed when they are `undefined`
 * — the same behavior an existing opted-in-but-incomplete V4 portfolio
 * already has. A section counts as "touched" only if it was
 * successfully live-prefilled at least once, OR the user has manually
 * edited at least one of its fields (`dirtyFields`) — `0`, the untouched
 * default, is otherwise NOT submitted as if it were a deliberate
 * all-zero assumption, so a portfolio created with the V4 fieldset left
 * entirely alone gets `v4DebtState`/`v4CollateralRisk` left `undefined`,
 * reproducing the exact same, already-tested, already-correct
 * "sync a live position or enter it manually" fail-closed Dashboard
 * state an existing incomplete V4 portfolio already shows — this batch
 * makes that state reachable earlier, it does not invent a new one.
 *
 * **Pre-validates before returning anything to the caller.**
 * `prepareSubmission()` (exposed via ref) re-validates every touched
 * section against the exact same schemas `setAaveV4DebtState`/
 * `setAaveV4CollateralRisk`/`setAaveV4Position` themselves re-validate
 * against (`aaveV4DebtStateSchema`, `aaveV4CollateralRiskConfigSchema`,
 * `aaveV4PositionIdentitySchema`) and returns `{ ok: false }` on the
 * first failure — the parent's own `onSubmit` checks this BEFORE ever
 * calling `create()`, so an invalid V4 entry never leaves a partially
 * configured portfolio behind (the batch's own "pre-validate the
 * complete V4 configuration before starting the post-`create()`
 * mutation chain" requirement).
 *
 * **`dynamicConfigKey` is never presented to the user, exactly like
 * `ManualAaveV4StateForm.tsx`.** A live-sourced collateral-risk section
 * carries the real value read off `useAaveV4CollateralRiskLiveDataStore`;
 * a manually-touched one is stamped `0`, the same fixed sentinel that
 * component already documents at length.
 */
export interface NewPortfolioV4DebtStateSubmission {
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
  debtAssetPriceUsd?: number;
}

export interface NewPortfolioV4CollateralRiskSubmission {
  collateralFactor: number;
  dynamicConfigKey: number;
}

export type NewPortfolioV4SubmissionResult =
  | {
      ok: true;
      position?: { userAddress: `0x${string}` };
      debtState?: NewPortfolioV4DebtStateSubmission;
      debtStateSource: AaveV4DataSource;
      collateralRisk?: NewPortfolioV4CollateralRiskSubmission;
      collateralRiskSource: AaveV4DataSource;
    }
  | { ok: false };

export interface NewPortfolioV4FieldsHandle {
  prepareSubmission: () => NewPortfolioV4SubmissionResult;
}

interface V4FormValues {
  userAddress: string;
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
  collateralFactor: number;
}

const DEFAULT_V4_VALUES: V4FormValues = {
  userAddress: '',
  drawnDebt: 0,
  premiumDebt: 0,
  baseDrawnApr: 0,
  riskPremium: 0,
  collateralFactor: 0,
};

const manualCollateralFactorSchema = aaveV4CollateralRiskConfigSchema.pick({
  collateralFactor: true,
});

function fromPercentInput(percent: number): number {
  return percent / 100;
}

function toPercentInput(fraction: number): number {
  return fraction * 100;
}

function RequiredMark() {
  return <span aria-hidden="true">*</span>;
}

/**
 * Status text for the wallet-POSITION half of debt assumptions —
 * `drawnDebt`/`premiumDebt`/`riskPremium` only. Deliberately never
 * claims "live position" for `baseDrawnApr`, which has its own
 * independent, address-free live source and its own status text
 * (`liveBaseDrawnAprStatusText` below) — V4 Manual-Data / Provenance
 * Audit's own explicit requirement: "Do not claim a value is live
 * position merely because another field in the same group was fetched
 * live."
 */
function liveWalletDebtStatusText(
  status: ReturnType<typeof useAaveV4LiveDataStore.getState>['status'],
  hasValidAddress: boolean,
): string {
  if (!hasValidAddress) {
    return 'Enter an on-chain address above to attempt live wallet-position sync for drawn debt, premium debt, and risk premium, or fill them in below by hand.';
  }
  if (status === 'idle' || status === 'loading') {
    return 'Checking for a live Aave V4 wallet position…';
  }
  if (status === 'error') {
    return 'Live Aave V4 wallet-position data is unavailable right now — enter drawn debt, premium debt, and risk premium manually below.';
  }
  return 'Aave V4 · Live wallet position found — drawn debt, premium debt, and risk premium below are pre-filled and still editable.';
}

/**
 * Status text for `baseDrawnApr` alone — the market's own current base
 * rate, address-independent (`useAaveV4BaseDrawnRateStore`, V4
 * Manual-Data / Provenance Audit). Fires the instant a debt asset is
 * chosen, no wallet required, mirroring `v4ReservePriceStatusText`
 * (`NewPortfolioPageClient.tsx`) for the collateral price.
 */
function liveBaseDrawnAprStatusText(
  status: ReturnType<typeof useAaveV4BaseDrawnRateStore.getState>['status'],
): string {
  if (status === 'idle' || status === 'loading') {
    return 'Checking for a live Aave V4 market base drawn rate…';
  }
  if (status === 'error') {
    return 'Live Aave V4 base drawn rate is unavailable right now — enter a value manually below.';
  }
  return 'Aave V4 · Live market base drawn rate — value below is pre-filled and still editable.';
}

function liveCollateralRiskStatusText(
  status: ReturnType<typeof useAaveV4CollateralRiskLiveDataStore.getState>['status'],
  hasValidAddress: boolean,
): string {
  if (!hasValidAddress) {
    return 'Enter an on-chain address above to attempt live collateral-risk sync, or fill in the assumption below by hand.';
  }
  if (status === 'idle' || status === 'loading') {
    return 'Checking for live Aave V4 collateral-risk data…';
  }
  if (status === 'error') {
    return 'Live Aave V4 collateral-risk data is unavailable right now — enter a value manually below.';
  }
  return 'Aave V4 · Live collateral risk found — value below is pre-filled and still editable.';
}

export const NewPortfolioV4Fields = forwardRef<NewPortfolioV4FieldsHandle, { debtAsset: string }>(
  function NewPortfolioV4Fields({ debtAsset }, ref) {
    const {
      register,
      watch,
      setValue,
      getValues,
      setError,
      formState: { errors, dirtyFields },
    } = useForm<V4FormValues>({ defaultValues: DEFAULT_V4_VALUES });

    const [debtStatePrefilled, setDebtStatePrefilled] = useState(false);
    const [baseDrawnAprPrefilled, setBaseDrawnAprPrefilled] = useState(false);
    const [collateralRiskPrefilled, setCollateralRiskPrefilled] = useState(false);

    const userAddress = watch('userAddress');
    const trimmedAddress = userAddress.trim();
    const hasValidAddressShape = hasEvmAddressShape(trimmedAddress);
    const watchedDrawnDebt = watch('drawnDebt');
    const watchedPremiumDebt = watch('premiumDebt');

    const fetchAaveV4LiveData = useAaveV4LiveDataStore((state) => state.fetchAaveV4LiveData);
    const debtStateStatus = useAaveV4LiveDataStore((state) => state.status);
    const debtStateEngineInputs = useAaveV4LiveDataStore((state) => state.engineInputs);
    const debtStateFetchedAddress = useAaveV4LiveDataStore((state) => state.userAddress);
    const debtStateFetchedAsset = useAaveV4LiveDataStore((state) => state.debtAsset);

    const fetchAaveV4BaseDrawnRate = useAaveV4BaseDrawnRateStore(
      (state) => state.fetchAaveV4BaseDrawnRate,
    );
    const baseDrawnRateStatus = useAaveV4BaseDrawnRateStore((state) => state.status);
    const baseDrawnRateCanonical = useAaveV4BaseDrawnRateStore((state) => state.canonical);
    const baseDrawnRateFetchedAsset = useAaveV4BaseDrawnRateStore((state) => state.debtAsset);

    const fetchAaveV4CollateralRiskLiveData = useAaveV4CollateralRiskLiveDataStore(
      (state) => state.fetchAaveV4CollateralRiskLiveData,
    );
    const collateralRiskStatus = useAaveV4CollateralRiskLiveDataStore((state) => state.status);
    const collateralRiskCanonical = useAaveV4CollateralRiskLiveDataStore(
      (state) => state.canonical,
    );
    const collateralRiskFetchedAddress = useAaveV4CollateralRiskLiveDataStore(
      (state) => state.userAddress,
    );

    // Collateral-risk fetch: keyed on address alone (no debt-asset
    // dimension — see this file's own header comment).
    useEffect(() => {
      if (!hasValidAddressShape) return;
      void fetchAaveV4CollateralRiskLiveData(trimmedAddress as `0x${string}`);
    }, [hasValidAddressShape, trimmedAddress, fetchAaveV4CollateralRiskLiveData]);

    // Wallet-position debt fetch: keyed on address AND debt asset — a
    // debt-asset change alone re-fires this, never the collateral-risk
    // fetch above. Only ever prefills `drawnDebt`/`premiumDebt`/
    // `riskPremium` now — `baseDrawnApr` has its own independent,
    // address-free source below (V4 Manual-Data / Provenance Audit),
    // never duplicated here, so the two provenances can never fight over
    // the same field.
    useEffect(() => {
      if (!hasValidAddressShape) return;
      void fetchAaveV4LiveData(trimmedAddress as `0x${string}`, debtAsset);
    }, [hasValidAddressShape, trimmedAddress, debtAsset, fetchAaveV4LiveData]);

    // Base-drawn-rate fetch: keyed on debt asset alone, no address
    // required — `IHub.getAssetDrawnRate` is the market's own current
    // rate for the asset, never wallet-specific (V4 Manual-Data /
    // Provenance Audit). Fires the moment a debt asset is chosen,
    // mirroring `NewPortfolioPageClient.tsx`'s own unconditional V4
    // reserve-price fetch for the collateral side.
    useEffect(() => {
      void fetchAaveV4BaseDrawnRate(debtAsset);
    }, [debtAsset, fetchAaveV4BaseDrawnRate]);

    // Prefill collateral factor once a matching live snapshot lands.
    useEffect(() => {
      if (collateralRiskStatus !== 'ready' || collateralRiskCanonical === null) return;
      if (collateralRiskFetchedAddress !== trimmedAddress) return;
      if (!dirtyFields.collateralFactor) {
        setValue('collateralFactor', toPercentInput(collateralRiskCanonical.collateralFactor), {
          shouldDirty: false,
        });
      }
      setCollateralRiskPrefilled(true);
    }, [
      collateralRiskStatus,
      collateralRiskCanonical,
      collateralRiskFetchedAddress,
      trimmedAddress,
      dirtyFields.collateralFactor,
      setValue,
    ]);

    // Prefill drawn debt, premium debt, and risk premium once a matching
    // live wallet-position snapshot lands — matching address AND debt
    // asset, mirroring V3's own `protocolQuote.borrowAsset === debtAsset`
    // mismatch guard. `baseDrawnApr` is deliberately NOT prefilled here
    // any more — see the dedicated effect below, and this file's own
    // "do not claim live position merely because another field in the
    // same group was fetched live" requirement.
    useEffect(() => {
      if (debtStateStatus !== 'ready' || debtStateEngineInputs === null) return;
      if (debtStateFetchedAddress !== trimmedAddress || debtStateFetchedAsset !== debtAsset) return;
      if (!dirtyFields.drawnDebt) {
        setValue('drawnDebt', debtStateEngineInputs.drawnDebt, { shouldDirty: false });
      }
      if (!dirtyFields.premiumDebt) {
        setValue('premiumDebt', debtStateEngineInputs.premiumDebt, { shouldDirty: false });
      }
      if (!dirtyFields.riskPremium) {
        setValue('riskPremium', toPercentInput(debtStateEngineInputs.riskPremium), {
          shouldDirty: false,
        });
      }
      setDebtStatePrefilled(true);
    }, [
      debtStateStatus,
      debtStateEngineInputs,
      debtStateFetchedAddress,
      debtStateFetchedAsset,
      trimmedAddress,
      debtAsset,
      dirtyFields.drawnDebt,
      dirtyFields.premiumDebt,
      dirtyFields.riskPremium,
      setValue,
    ]);

    // Prefill base drawn APR once a matching live market snapshot lands —
    // matching debt asset only, no address/identity check needed (this
    // source never depends on a wallet). Independent prefilled flag from
    // `debtStatePrefilled` above so `prepareSubmission()` can correctly
    // report `debtStateSource: 'manual'` for the whole group whenever
    // EITHER independent source was never fetched live or was overridden
    // — never claiming "live" for a field that wasn't.
    useEffect(() => {
      if (baseDrawnRateStatus !== 'ready' || baseDrawnRateCanonical === null) return;
      if (baseDrawnRateFetchedAsset !== debtAsset) return;
      if (!dirtyFields.baseDrawnApr) {
        setValue('baseDrawnApr', toPercentInput(baseDrawnRateCanonical.baseDrawnApr), {
          shouldDirty: false,
        });
      }
      setBaseDrawnAprPrefilled(true);
    }, [
      baseDrawnRateStatus,
      baseDrawnRateCanonical,
      baseDrawnRateFetchedAsset,
      debtAsset,
      dirtyFields.baseDrawnApr,
      setValue,
    ]);

    useImperativeHandle(ref, () => ({
      prepareSubmission: (): NewPortfolioV4SubmissionResult => {
        const values = getValues();
        const addressInput = values.userAddress.trim();

        let position: { userAddress: `0x${string}` } | undefined;
        if (addressInput.length > 0) {
          const parsed = aaveV4PositionIdentitySchema.safeParse({ userAddress: addressInput });
          if (!parsed.success) {
            setError('userAddress', {
              message: parsed.error.issues[0]?.message ?? 'Enter a valid wallet address.',
            });
            return { ok: false };
          }
          position = { userAddress: parsed.data.userAddress as `0x${string}` };
        }

        // Two independent sub-groups feed the one persisted `v4DebtState`
        // object: `baseDrawnApr` (its own address-free market source) and
        // `drawnDebt`/`premiumDebt`/`riskPremium` (the wallet-position
        // source). Computed and gated separately so neither can borrow
        // the other's provenance — V4 Manual-Data / Provenance Audit's
        // own explicit requirement: "Do not claim a value is live
        // position merely because another field in the same group was
        // fetched live."
        const baseDrawnAprTouched = baseDrawnAprPrefilled || Boolean(dirtyFields.baseDrawnApr);
        const baseDrawnAprLive = baseDrawnAprPrefilled && !dirtyFields.baseDrawnApr;

        const walletDebtDirty = Boolean(
          dirtyFields.drawnDebt || dirtyFields.premiumDebt || dirtyFields.riskPremium,
        );
        const walletDebtTouched = debtStatePrefilled || walletDebtDirty;
        const walletDebtLive = debtStatePrefilled && !walletDebtDirty;

        const debtStateTouched = baseDrawnAprTouched || walletDebtTouched;
        let debtState: NewPortfolioV4DebtStateSubmission | undefined;
        let debtStateSource: AaveV4DataSource = 'manual';
        if (debtStateTouched) {
          const parsed = aaveV4DebtStateSchema.safeParse({
            drawnDebt: values.drawnDebt,
            premiumDebt: values.premiumDebt,
            baseDrawnApr: values.baseDrawnApr,
            riskPremium: values.riskPremium,
          });
          if (!parsed.success) {
            setError('drawnDebt', {
              message: parsed.error.issues[0]?.message ?? 'Enter valid Aave V4 debt assumptions.',
            });
            return { ok: false };
          }
          // 'live' only when EVERY currently-populated sub-group is
          // itself live-and-unedited — a group that was never touched at
          // all trivially satisfies its own condition (nothing to
          // overclaim), but a group that IS touched must genuinely be
          // live, never merely because its sibling group is.
          const baseDrawnAprOk = !baseDrawnAprTouched || baseDrawnAprLive;
          const walletDebtOk = !walletDebtTouched || walletDebtLive;
          debtStateSource = baseDrawnAprOk && walletDebtOk ? 'live' : 'manual';
          debtState = {
            drawnDebt: parsed.data.drawnDebt,
            premiumDebt: parsed.data.premiumDebt,
            baseDrawnApr: parsed.data.baseDrawnApr,
            riskPremium: parsed.data.riskPremium,
            debtAssetPriceUsd:
              debtStateSource === 'live' ? debtStateEngineInputs?.debtAssetPriceUsd : undefined,
          };
        }

        const collateralFactorDirty = Boolean(dirtyFields.collateralFactor);
        const collateralRiskTouched = collateralRiskPrefilled || collateralFactorDirty;
        let collateralRisk: NewPortfolioV4CollateralRiskSubmission | undefined;
        let collateralRiskSource: AaveV4DataSource = 'manual';
        if (collateralRiskTouched) {
          const parsed = manualCollateralFactorSchema.safeParse({
            collateralFactor: values.collateralFactor,
          });
          if (!parsed.success) {
            setError('collateralFactor', {
              message: parsed.error.issues[0]?.message ?? 'Enter a valid collateral factor.',
            });
            return { ok: false };
          }
          collateralRiskSource =
            collateralRiskPrefilled && !collateralFactorDirty ? 'live' : 'manual';
          collateralRisk = {
            collateralFactor: parsed.data.collateralFactor,
            // `dynamicConfigKey` is never user-facing — see this file's
            // own header comment, mirroring `ManualAaveV4StateForm.tsx`.
            dynamicConfigKey:
              collateralRiskSource === 'live'
                ? (collateralRiskCanonical?.dynamicConfigKey ?? 0)
                : 0,
          };
        }

        return {
          ok: true,
          position,
          debtState,
          debtStateSource,
          collateralRisk,
          collateralRiskSource,
        };
      },
    }));

    return (
      <div className="flex flex-col gap-4 rounded-md border border-border p-3">
        <label className="flex flex-col gap-1 text-sm">
          <span>On-chain address (optional)</span>
          <input
            id="v4.userAddress"
            placeholder="0x…"
            {...register('userAddress')}
            aria-invalid={errors.userAddress ? 'true' : undefined}
            aria-describedby={errors.userAddress ? 'v4.userAddress-error' : undefined}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <p className="text-xs text-muted-foreground">
          The wallet address whose Aave V4 position this portfolio&rsquo;s live figures are read
          from — not your sign-in identity. Leave blank to enter everything manually, with no wallet
          or RPC call required.
        </p>
        {errors.userAddress && (
          <span id="v4.userAddress-error" className="text-xs text-destructive">
            {errors.userAddress.message}
          </span>
        )}

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">Debt assumptions</p>
          <p role="status" className="text-xs text-muted-foreground">
            {liveWalletDebtStatusText(debtStateStatus, hasValidAddressShape)}
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span>
              Drawn debt <RequiredMark />
            </span>
            <input
              id="v4.drawnDebt"
              aria-required="true"
              type="number"
              step="any"
              {...register('drawnDebt', { valueAsNumber: true })}
              aria-invalid={errors.drawnDebt ? 'true' : undefined}
              aria-describedby={errors.drawnDebt ? 'v4.drawnDebt-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.drawnDebt && (
            <span id="v4.drawnDebt-error" className="text-xs text-destructive">
              {errors.drawnDebt.message}
            </span>
          )}

          <label className="flex flex-col gap-1 text-sm">
            <span>
              Premium debt <RequiredMark />
            </span>
            <input
              id="v4.premiumDebt"
              aria-required="true"
              type="number"
              step="any"
              {...register('premiumDebt', { valueAsNumber: true })}
              aria-invalid={errors.premiumDebt ? 'true' : undefined}
              aria-describedby={errors.premiumDebt ? 'v4.premiumDebt-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.premiumDebt && (
            <span id="v4.premiumDebt-error" className="text-xs text-destructive">
              {errors.premiumDebt.message}
            </span>
          )}

          {/*
            Read-only, derived total — V4 Manual-Data / Provenance Audit's
            "hide-and-compute" design decision. Canonical V4 total debt is
            ALWAYS `drawnDebt + premiumDebt`; this is the one place that
            sum is shown to the user during creation, never a second,
            independently-editable "Debt balance" field that could
            disagree with it (see `NewPortfolioPageClient.tsx`'s own
            gating of the legacy shared field to V3 only).
          */}
          <p className="text-sm text-muted-foreground">
            Total debt (drawn + premium):{' '}
            <span className="font-medium text-foreground">
              {(
                (Number.isFinite(watchedDrawnDebt) ? watchedDrawnDebt : 0) +
                (Number.isFinite(watchedPremiumDebt) ? watchedPremiumDebt : 0)
              ).toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          </p>

          <div className="flex flex-col gap-2 border-t border-border pt-3">
            <p role="status" className="text-xs text-muted-foreground">
              {liveBaseDrawnAprStatusText(baseDrawnRateStatus)}
            </p>
            <label className="flex flex-col gap-1 text-sm">
              <span>
                Base drawn APR (%) <RequiredMark />
              </span>
              <input
                id="v4.baseDrawnApr"
                aria-required="true"
                type="number"
                step="any"
                {...register('baseDrawnApr', {
                  setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
                })}
                aria-invalid={errors.baseDrawnApr ? 'true' : undefined}
                aria-describedby={errors.baseDrawnApr ? 'v4.baseDrawnApr-error' : undefined}
                className="rounded-md border border-border bg-transparent px-3 py-2"
              />
            </label>
            {errors.baseDrawnApr && (
              <span id="v4.baseDrawnApr-error" className="text-xs text-destructive">
                {errors.baseDrawnApr.message}
              </span>
            )}
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span>
              Risk premium (%) <RequiredMark />
            </span>
            <input
              id="v4.riskPremium"
              aria-required="true"
              type="number"
              step="any"
              {...register('riskPremium', {
                setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
              })}
              aria-invalid={errors.riskPremium ? 'true' : undefined}
              aria-describedby={errors.riskPremium ? 'v4.riskPremium-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.riskPremium && (
            <span id="v4.riskPremium-error" className="text-xs text-destructive">
              {errors.riskPremium.message}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-foreground">Collateral risk assumption</p>
          <p role="status" className="text-xs text-muted-foreground">
            {liveCollateralRiskStatusText(collateralRiskStatus, hasValidAddressShape)}
          </p>

          <label className="flex flex-col gap-1 text-sm">
            <span>
              Collateral factor (%) <RequiredMark />
            </span>
            <input
              id="v4.collateralFactor"
              aria-required="true"
              type="number"
              step="any"
              {...register('collateralFactor', {
                setValueAs: (value) => (value === '' ? NaN : fromPercentInput(Number(value))),
              })}
              aria-invalid={errors.collateralFactor ? 'true' : undefined}
              aria-describedby={errors.collateralFactor ? 'v4.collateralFactor-error' : undefined}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {errors.collateralFactor && (
            <span id="v4.collateralFactor-error" className="text-xs text-destructive">
              {errors.collateralFactor.message}
            </span>
          )}
        </div>
      </div>
    );
  },
);

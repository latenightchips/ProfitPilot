'use client';

import { useEffect, useRef } from 'react';

import type { AaveV4EngineDebtInputsData } from '@/stores/aaveV4LiveDataStore';
import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';
import { aaveV4DebtStateEqual, usePortfolioStore } from '@/stores/portfolioStore';

/**
 * V4 Readiness Audit §12 Stage 7 — the production data path that
 * populates a real portfolio's `v4DebtState` (Stage 6) from actual Aave
 * V4 on-chain reads (Stage 3's adapter, via Stage 4B's
 * `/api/aave/v4-position` route), instead of requiring a direct
 * `setAaveV4DebtState` Store call from a test or script. Mirrors
 * `hooks/useAaveLiveSync.ts`'s own shape closely, with one structural
 * difference driven by this stage's own requirements.
 *
 * **Fetches only when a portfolio has explicitly opted in to V4 — both
 * `protocolVersion === 'v4'` AND `v4Position` set.** `useAaveLiveSync`
 * fetches unconditionally (V3 has no per-wallet identity to gate on);
 * V4 genuinely does, and there is still no UI to set either field (Stage
 * 7's own non-goal, same as Stage 5/6) — every real portfolio today has
 * both `undefined`, so this hook makes zero fetch calls and zero Store
 * writes for any of them. This is "preserve V3 behavior exactly" made
 * structural, not just tested: a V3 portfolio cannot reach the fetch
 * call at all, the same way `useAaveLiveSync` cannot reach
 * `collateral`/`debt`. Requiring BOTH fields (not just `v4Position`
 * alone) is a deliberate product choice, not an accident of the
 * underlying schema — `services/portfolio/models.ts`'s own "no
 * cross-inference" discipline governs `setProtocolVersion`/
 * `setAaveV4Position`/`setAaveV4DebtState` as independent mutations, but
 * says nothing about how a *consumer* like this hook chooses to act on
 * their combination; requiring both here is the conservative reading —
 * a portfolio that only has `v4Position` set hasn't opted into V4 debt
 * dispatch yet, and one that only has `protocolVersion: 'v4'` set has no
 * address to read from.
 *
 * **Identity boundary, doubled.** `stores/aaveV4LiveDataStore.ts`'s own
 * `latestRequestId` guard already discards a stale in-flight response
 * once a *newer* request has resolved. This hook adds a second,
 * independent check before ever writing: the store's own
 * `userAddress`/`debtAsset` (whichever identity the last-landed fetch
 * actually belongs to) must still match this specific portfolio's
 * *current* `v4Position.userAddress`/`debt.asset` — protecting against a
 * response that arrives after the user (or a test) changed the address,
 * switched the debt asset, or switched the active portfolio entirely
 * while the fetch was in flight. Either mismatch means "this data
 * belongs to a different identity" and the sync effect no-ops, exactly
 * like `useAaveLiveSync`'s own borrow-asset mismatch guard.
 *
 * **Equality-gated**, via `aaveV4DebtStateEqual` (`stores/portfolioStore.ts`),
 * the same reasoning as `marketPricesEqual`/`protocolParametersEqual`:
 * `setAaveV4DebtState` always bumps `updatedAt`, so calling it on an
 * unchanged refresh would needlessly clear an open Preview.
 *
 * **On RPC failure, does nothing** — same as `useAaveLiveSync`: this
 * hook's sync effect only ever acts on `status === 'ready'` data, so a
 * failed fetch leaves `v4DebtState` exactly as it was, never blanked.
 *
 * **Never fabricates or infers `v4DebtState`.** The only value ever
 * written is `engineInputs` exactly as returned by
 * `/api/aave/v4-position`, which is itself exactly the Stage 3 adapter's
 * `mapAaveV4Snapshot` output — real, live-computed on-chain values, no
 * placeholder math anywhere in this path.
 *
 * `services/simulation/scenario.ts` still does not read `v4DebtState`
 * (Stage 7's own scope: sourcing the data, not consuming it for
 * Simulation) — a portfolio can now have a real, live-synced
 * `v4DebtState` and still fail closed with
 * `AAVE_V4_SIMULATION_UNSUPPORTED`, unchanged from Stage 6.
 *
 * **Manual → live conflict confirmation (V4 Readiness Audit §12 P0-1).**
 * A successful live fetch auto-adopts as `'live'` immediately — no
 * confirmation — in exactly two cases: (1) the portfolio has no existing
 * `v4DebtState` at all (nothing to protect), or (2) the existing value is
 * already `'live'`-sourced (the established, automatic live→live
 * refresh model, unchanged) or is `'manual'`-sourced but numerically
 * identical to the fetched value (`aaveV4DebtStateEqual`) — the Stage 25
 * rule that identical values transition silently, still true. The one
 * case that is NOT automatic: an existing `'manual'` value that
 * genuinely differs from the fetched value. There, canonical
 * `v4DebtState` is left completely untouched (calculations keep using
 * the manual value) and the fetched value is instead registered as a
 * pending candidate via `setAaveV4DebtStateCandidate`
 * (`stores/portfolioStore.ts`) — reusing `useAaveV4LiveDataStore`'s own
 * already-fetched `engineInputs` object directly, no duplicate copy. The
 * candidate only becomes canonical once the user explicitly calls
 * `acceptAaveV4DebtStateCandidate` (the "Use Live Data" action,
 * `app/portfolio/AaveV4ConflictConfirmation.tsx`) — never automatically.
 * `dismissAaveV4DebtStateCandidate` ("Keep Manual") clears the candidate
 * without writing anything; because `lastAppliedEngineInputs` below is
 * set at candidate-creation time (not just at write time), the same
 * fetched object is never re-offered as a candidate again after being
 * dismissed — only a genuinely NEW fetch (a new `engineInputs` object)
 * can surface a new conflict, satisfying "dismissal must not permanently
 * disable future live synchronization."
 *
 * **Classified live-fetch error surfacing (V4 Readiness Audit §12
 * P0-4).** `useAaveV4LiveDataStore`'s own `errorMessage`/`errorCode`
 * already carry the real classified `AAVE_V4_*` failure (timeout,
 * network error, unsupported asset, missing position, etc. — see that
 * store's own header comment) — this hook is what makes that reach the
 * UI, via `setAaveV4DebtStateError` (`stores/portfolioStore.ts`),
 * portfolio-scoped exactly like the candidate mechanism above. Recorded
 * ONLY when the store's own `attemptedUserAddress`/`attemptedDebtAsset`
 * (the identity the FAILED fetch was actually for, set at the start of
 * every attempt — unlike `userAddress`/`debtAsset`, which only update on
 * a SUCCESS) match this portfolio's CURRENT identity — never a
 * stale/foreign identity's error. Cleared in two places: (1) the
 * identity-removal branch below, alongside the candidate clear; (2)
 * whenever a genuinely new fetch SUCCEEDS for this portfolio (whether it
 * auto-applies, no-ops on equality, or creates a candidate — the fetch
 * itself still succeeded). Manual canonical state and any pending P0-1
 * candidate are completely unaffected by an error either appearing or
 * clearing, since this uses its own separate Store map, never touching
 * `v4DebtState`/`v4DebtStateCandidates`.
 *
 * **Clears on identity removal.** Mirrors
 * `hooks/useAaveV4CollateralRiskLiveSync.ts`'s own fix for the identical
 * problem: `services/portfolio/mapping.ts`'s total-debt derivation reads
 * `v4DebtState.drawnDebt + v4DebtState.premiumDebt` whenever
 * `protocolVersion === 'v4'`, with no dependency on `v4Position` being
 * currently set — so a stale `v4DebtState` left behind after the wallet
 * address is removed would silently keep feeding a REAL Health
 * Factor/liquidation/borrow-capacity calculation. When this hook's own
 * fetch-gating condition is false (no `userAddress`/`debtAsset` to sync
 * against — either `protocolVersion` left `'v4'`, or `v4Position` was
 * cleared) AND the portfolio still carries a `v4DebtState`, this hook
 * clears it via `setAaveV4DebtState(portfolioId, undefined)` — but only
 * when `v4DebtStateSource === 'live'`. A `'manual'` value has no
 * dependency on a wallet address at all, by design, and must never be
 * cleared by this logic.
 *
 * **Never re-applies an already-consumed fetch result (V4 Readiness
 * Audit §12 Stage 14 fix).** The write effect below lists `portfolio` as
 * a dependency (needed so it re-evaluates after a *fetch* lands, since
 * `portfolio.v4DebtState` is part of the equality check), which means it
 * also re-runs after ANY OTHER portfolio update — including a Debt-form
 * Apply that locally derives a new `v4DebtState` from a real Stage-12
 * repayment. Previously, that re-run would find `engineInputs` (still
 * the same value from the last successful fetch, since nothing new was
 * fetched) no longer equal to the just-updated `v4DebtState`, and
 * "correct" it by writing the stale fetched value straight back over
 * the newer local one — silently discarding a correct repay result.
 * `lastAppliedEngineInputs` tracks the specific `engineInputs` object
 * this hook has already synced onto the portfolio; the write effect now
 * only acts on a genuinely NEW one (the store creates a fresh object on
 * every successful fetch, so identity alone distinguishes "already
 * handled this result" from "a new live read landed"). A real new fetch
 * — the only way `engineInputs` actually changes — still always wins,
 * exactly as before.
 */
const FALLBACK_ERROR_MESSAGE = 'Live Aave V4 data is temporarily unavailable.';

export function useAaveV4LiveSync(portfolioId: string | null): void {
  const status = useAaveV4LiveDataStore((state) => state.status);
  const engineInputs = useAaveV4LiveDataStore((state) => state.engineInputs);
  const fetchedUserAddress = useAaveV4LiveDataStore((state) => state.userAddress);
  const fetchedDebtAsset = useAaveV4LiveDataStore((state) => state.debtAsset);
  const errorMessage = useAaveV4LiveDataStore((state) => state.errorMessage);
  const errorCode = useAaveV4LiveDataStore((state) => state.errorCode);
  const attemptedUserAddress = useAaveV4LiveDataStore((state) => state.attemptedUserAddress);
  const attemptedDebtAsset = useAaveV4LiveDataStore((state) => state.attemptedDebtAsset);
  const fetchAaveV4LiveData = useAaveV4LiveDataStore((state) => state.fetchAaveV4LiveData);
  const setAaveV4DebtState = usePortfolioStore((state) => state.setAaveV4DebtState);
  const touchAaveV4DebtStateFreshness = usePortfolioStore(
    (state) => state.touchAaveV4DebtStateFreshness,
  );
  const setAaveV4DebtStateCandidate = usePortfolioStore(
    (state) => state.setAaveV4DebtStateCandidate,
  );
  const setAaveV4DebtStateError = usePortfolioStore((state) => state.setAaveV4DebtStateError);
  const portfolio = usePortfolioStore((state) =>
    portfolioId !== null ? state.portfolios[portfolioId]?.portfolio : undefined,
  );

  const userAddress =
    portfolio?.protocolVersion === 'v4' ? portfolio.v4Position?.userAddress : undefined;
  const debtAsset = portfolio?.debt.asset;

  const lastAppliedEngineInputs = useRef<AaveV4EngineDebtInputsData | null>(null);

  useEffect(() => {
    if (userAddress === undefined || debtAsset === undefined) return;
    void fetchAaveV4LiveData(userAddress, debtAsset);
  }, [fetchAaveV4LiveData, userAddress, debtAsset]);

  useEffect(() => {
    if (portfolioId === null || portfolio === undefined) return;

    if (userAddress === undefined || debtAsset === undefined) {
      // No identity to sync against — see this hook's own "Clears on
      // identity removal" header comment. Only clears a previously
      // `'live'`-sourced value that is now orphaned by the identity's
      // removal — NEVER a `'manual'` one (same invariant
      // `useAaveV4CollateralRiskLiveSync` already establishes): manual
      // entries have no dependency on a wallet address at all, by
      // design, so a portfolio with no address and a valid manual
      // `v4DebtState` must be left completely untouched here. Genuine
      // no-op (no Store write, no updatedAt bump) for every portfolio
      // that never had `v4DebtState` set in the first place — V3
      // portfolios never reach this branch's write.
      if (portfolio.v4DebtState !== undefined && portfolio.v4DebtStateSource === 'live') {
        setAaveV4DebtState(portfolioId, undefined);
      }
      // V4 Readiness Audit §12 — P0-1. An identity that goes away
      // invalidates any pending confirmation candidate that was
      // computed against it — never left actionable/displayed once the
      // wallet it came from is gone. Independent of the branch above:
      // this must clear even when the canonical value is `'manual'`
      // (left untouched by the branch above) and a candidate was still
      // pending against it.
      setAaveV4DebtStateCandidate(portfolioId, undefined);
      // V4 Readiness Audit §12 — P0-4. Same reasoning as the candidate
      // clear immediately above: an identity that goes away invalidates
      // any error that was surfaced for it, regardless of the canonical
      // source branch above.
      setAaveV4DebtStateError(portfolioId, undefined);
      return;
    }

    if (status === 'error') {
      // V4 Readiness Audit §12 — P0-4. Only attribute this error to the
      // CURRENT portfolio's identity if the failed attempt was actually
      // FOR it — `attemptedUserAddress`/`attemptedDebtAsset` are set at
      // the start of every fetch attempt (success or failure), unlike
      // `userAddress`/`debtAsset` (only updated on success), so this is
      // the one reliable way to guard a failure the same way a success
      // is already guarded. A mismatch means this error belongs to a
      // different, now-irrelevant identity (e.g. a fetch that was
      // already superseded by a newer one for a different portfolio) —
      // never displayed.
      if (attemptedUserAddress === userAddress && attemptedDebtAsset === debtAsset) {
        setAaveV4DebtStateError(portfolioId, {
          code: errorCode,
          message: errorMessage ?? FALLBACK_ERROR_MESSAGE,
        });
      }
      return;
    }

    if (status !== 'ready' || engineInputs === null) return;
    if (fetchedUserAddress !== userAddress || fetchedDebtAsset !== debtAsset) return;
    if (lastAppliedEngineInputs.current === engineInputs) return;
    lastAppliedEngineInputs.current = engineInputs;

    // A genuinely new fetch just succeeded for this portfolio — clear
    // any previously-displayed error regardless of what happens next
    // (auto-apply, no-op-on-equal, or a new candidate all mean the fetch
    // itself worked).
    setAaveV4DebtStateError(portfolioId, undefined);

    if (portfolio.v4DebtStateSource === 'live') {
      // Established live→live refresh model, unchanged: an unchanged
      // refresh skips the canonical write (avoids needlessly clearing an
      // open Preview); a genuinely different refresh auto-applies, no
      // confirmation — the freshness model your own audit asked to keep
      // as-is. V4 Readiness Audit §12 P2-3 — skipping the canonical
      // write must not also silently freeze the persisted freshness
      // timestamp: `touchAaveV4DebtStateFreshness` refreshes
      // `v4DebtStateUpdatedAt` alone, without touching `v4DebtState`/
      // `Portfolio.updatedAt`, so a genuinely fresh confirmation is never
      // misreported as stale (`resolveExportProvenance`'s
      // `v4DataStaleAtExport`, and any future reload) merely because the
      // value itself happened not to change on this particular poll.
      //
      // V4 Readiness Audit §12 P1-D3 — a genuine defect found while
      // reviewing that stage: `aaveV4DebtStateEqual` deliberately never
      // compares `debtAssetPriceUsd` (see its own doc comment — it also
      // gates the manual↔live numeric-match case below, where excluding
      // price is required, not a gap). Used alone here, a refresh that
      // changed ONLY the oracle price (quantity/rates unchanged) was
      // wrongly treated as a no-op — the stale price would never reach
      // canonical state until quantity or a rate also happened to change.
      // A live-sourced comparison additionally requires the price itself
      // to match; a manual-sourced portfolio never reaches this branch
      // (guarded by `v4DebtStateSource === 'live'` above), so this never
      // manufactures a spurious manual-vs-live conflict.
      const unchanged =
        aaveV4DebtStateEqual(engineInputs, portfolio.v4DebtState) &&
        engineInputs.debtAssetPriceUsd === portfolio.v4DebtState?.debtAssetPriceUsd;
      if (unchanged) {
        touchAaveV4DebtStateFreshness(portfolioId);
        return;
      }
      setAaveV4DebtState(portfolioId, engineInputs, 'live');
      return;
    }

    // No existing value (nothing to protect) OR an existing MANUAL value
    // that happens to numerically match the fetch (Stage 25's own "identical
    // values transition silently" rule) — auto-adopt, no confirmation.
    if (
      portfolio.v4DebtState === undefined ||
      aaveV4DebtStateEqual(engineInputs, portfolio.v4DebtState)
    ) {
      setAaveV4DebtState(portfolioId, engineInputs, 'live');
      return;
    }

    // An existing MANUAL value that genuinely differs from the fetch —
    // the one case this stage gates. Canonical state is NOT written;
    // the fetched value becomes a pending candidate instead, actionable
    // only via `acceptAaveV4DebtStateCandidate`/`dismissAaveV4DebtStateCandidate`.
    setAaveV4DebtStateCandidate(portfolioId, engineInputs);
  }, [
    portfolioId,
    portfolio,
    userAddress,
    debtAsset,
    status,
    engineInputs,
    fetchedUserAddress,
    fetchedDebtAsset,
    errorMessage,
    errorCode,
    attemptedUserAddress,
    attemptedDebtAsset,
    setAaveV4DebtState,
    touchAaveV4DebtStateFreshness,
    setAaveV4DebtStateCandidate,
    setAaveV4DebtStateError,
  ]);
}

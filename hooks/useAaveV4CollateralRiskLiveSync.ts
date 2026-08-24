'use client';

import { useEffect, useRef } from 'react';

import type { AaveV4CollateralRiskCanonicalData } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import {
  aaveV4CollateralRiskEqual,
  marketPricesEqual,
  usePortfolioStore,
} from '@/stores/portfolioStore';

/**
 * V4 Readiness Audit §12 Stage 23F — the production data path that
 * populates a real portfolio's `v4CollateralRisk` (Stage 23C) from actual
 * Aave V4 on-chain reads (`infrastructure/protocols/aave/v4`'s
 * `fetchAaveV4CollateralRiskSnapshot`, via `/api/aave/v4-collateral-risk`).
 * Closes the blocker Stage 23E's own audit found: `v4CollateralRisk`
 * existed in the adapter/domain/store and every V4 core calculation
 * already failed closed correctly when it was missing, but nothing ever
 * populated it for a real portfolio. Mirrors `hooks/useAaveV4LiveSync.ts`'s
 * own shape closely — same gating, same double identity check, same
 * equality gate, same "never re-apply an already-consumed fetch result"
 * protection — with one addition this stage's own requirements call for
 * (see "Clears on identity removal" below).
 *
 * **Fetches only when a portfolio has explicitly opted in to V4 — both
 * `protocolVersion === 'v4'` AND `v4Position` set**, the identical gating
 * condition `useAaveV4LiveSync` already uses. A V3 (or unset) portfolio
 * cannot reach the fetch call at all.
 *
 * **Keyed by `userAddress` alone, not `userAddress` + `debtAsset`.**
 * Unlike debt-state sync, collateral-risk always resolves the same fixed
 * collateral asset regardless of which stablecoin the portfolio borrows
 * (`stores/aaveV4CollateralRiskLiveDataStore.ts`'s own header comment) —
 * there is no second identity dimension to include in the dependency
 * array or the identity-mismatch guard below.
 *
 * **Identity boundary, doubled**, the same "protect against a response
 * that arrives after the user changed the address, or switched the
 * active portfolio, while the fetch was in flight" reasoning
 * `useAaveV4LiveSync` already documents: `useAaveV4CollateralRiskLiveDataStore`'s
 * own `latestRequestId` guard discards a stale in-flight response once a
 * newer request has resolved; this hook adds a second, independent check
 * before ever writing — the store's own `userAddress` (whichever identity
 * the last-landed fetch actually belongs to) must still match this
 * specific portfolio's *current* `v4Position.userAddress`.
 *
 * **Equality-gated**, via `aaveV4CollateralRiskEqual`
 * (`stores/portfolioStore.ts`) — `setAaveV4CollateralRisk` always bumps
 * `updatedAt`, so calling it on an unchanged refresh would needlessly
 * clear an open Preview, the same reasoning `aaveV4DebtStateEqual`
 * already establishes.
 *
 * **On RPC failure, does nothing** — same as `useAaveV4LiveSync`: this
 * hook's sync effect only ever acts on `status === 'ready'` data, so a
 * failed fetch leaves `v4CollateralRisk` exactly as it was, never blanked.
 *
 * **Never fabricates or infers `v4CollateralRisk`.** The only value ever
 * written is `canonical` exactly as returned by
 * `/api/aave/v4-collateral-risk`, which is itself exactly the Stage 23C
 * adapter's `mapAaveV4CollateralRiskSnapshot` output — the user's own
 * bound `dynamicConfigKey` and the `collateralFactor` read at that exact
 * key, never the reserve's current config, never a fallback to V3
 * `protocol` fields.
 *
 * **Never re-applies an already-consumed fetch result**, the identical
 * Stage 14 fix `useAaveV4LiveSync` already carries: the write effect
 * lists `portfolio` as a dependency (needed so it re-evaluates after a
 * fetch lands, since `portfolio.v4CollateralRisk` is part of the equality
 * check), which also means it re-runs after any other portfolio update.
 * `lastAppliedCanonical` tracks the specific `canonical` object this hook
 * has already synced onto the portfolio, so only a genuinely NEW fetch
 * result (a fresh object, by identity) is ever written.
 *
 * **Clears on identity removal (V4 Readiness Audit §12 Stage 23F's own
 * explicit requirement).** `useAaveV4LiveSync` now carries the identical
 * fix for `v4DebtState`, added later once the same staleness risk was
 * found there too — see that hook's own header comment. For collateral risk
 * specifically, a stale `collateralFactor` left behind after the address
 * is removed is not just a cosmetic staleness concern: `resolveRiskCapacityFraction`
 * (`services/portfolio/mapping.ts`) reads `v4CollateralRisk.collateralFactor`
 * whenever `protocolVersion === 'v4'`, with no dependency on `v4Position`
 * being currently set — so a lingering value would silently feed a REAL
 * Health Factor/liquidation calculation even after the user removed the
 * wallet address it was read from. When this hook's own fetch-gating
 * condition is false (no `userAddress` to sync against — either
 * `protocolVersion` left `'v4'`, or `v4Position` was cleared) AND the
 * portfolio still carries a `v4CollateralRisk` value, this hook actively
 * clears it via `setAaveV4CollateralRisk(portfolioId, undefined)`. Safe
 * in both cases: for a V4→V3 switch, `v4CollateralRisk` is already inert
 * for a V3 portfolio (`resolveRiskCapacityFraction`'s V3 branch never
 * reads it), so clearing it is a harmless tidy-up, not a behavior change;
 * for an address-only removal (still `protocolVersion: 'v4'`), it is the
 * necessary fix — there is no future fetch that would ever overwrite a
 * permanently-removed identity's stale value otherwise.
 *
 * **Manual → live conflict confirmation (V4 Readiness Audit §12 P0-1).**
 * Identical mechanism to `useAaveV4LiveSync.ts`'s own identical addition
 * — see that hook's own header comment for the full reasoning. A
 * successful fetch auto-adopts as `'live'` immediately when there is no
 * existing `v4CollateralRisk`, when the existing value is already
 * `'live'`, or when an existing `'manual'` value numerically matches the
 * fetch (`aaveV4CollateralRiskEqual`). Only a `'manual'` value that
 * genuinely differs is gated: canonical state stays untouched and the
 * fetched `canonical` becomes a pending candidate via
 * `setAaveV4CollateralRiskCandidate`, actionable only through
 * `acceptAaveV4CollateralRiskCandidate`/`dismissAaveV4CollateralRiskCandidate`
 * — independent of `v4DebtState`'s own candidate, by construction (each
 * dimension has its own candidate map, keyed by portfolio id).
 *
 * **Classified live-fetch error surfacing (V4 Readiness Audit §12
 * P0-4).** Identical mechanism to `useAaveV4LiveSync.ts`'s own identical
 * addition — see that hook's own header comment for the full reasoning.
 * `setAaveV4CollateralRiskError` records the store's classified
 * `errorMessage`/`errorCode`, guarded against `attemptedUserAddress`
 * (this store has no `debtAsset` dimension to also check), and is
 * cleared on identity removal and on any genuinely new successful fetch
 * — independent of `v4DebtState`'s own error, by construction.
 *
 * **`market.btcPriceUsd` ownership (V4 Readiness Audit §12 P1-C).** This
 * hook is now the SOLE writer of `market` for a V4 portfolio —
 * `hooks/useAaveLiveSync.ts`'s own V3-sourced write is structurally
 * gated off for `protocolVersion === 'v4'` (see that hook's own header
 * comment), never merely by execution order, so a V3 refresh can never
 * overwrite a V4 oracle price. The write uses
 * `canonical.collateralPriceUsd` (P1-B's V4-authoritative Spoke-oracle
 * read), equality-gated via `marketPricesEqual` like every other
 * `market` writer, and runs unconditionally whenever a genuinely new
 * fetch result lands (the same `lastAppliedCanonical` guard below) —
 * deliberately BEFORE and INDEPENDENT of `collateralFactor`'s own
 * manual/live candidate gating further down: `market` has no
 * manual/live provenance dimension of its own (unlike `v4CollateralRisk`),
 * so a differing manual `collateralFactor` must never block a genuine
 * V4 price update. On fetch failure (`status === 'error'`, handled in
 * the branch above, returning before this code ever runs), `market` is
 * left exactly as it was — never substituted with 0, $1, a V3 price, or
 * silently relabeled. On identity removal (V4 address cleared, or
 * switched back to V3), `market` is deliberately NOT actively cleared
 * here either, mirroring `useAaveLiveSync.ts`'s own established
 * "does not clear/migrate/fabricate" precedent for `protocol`: a V3
 * switch hands ownership back to `useAaveLiveSync` immediately (its own
 * gate re-opens the moment `protocolVersion` changes), which then
 * overwrites the stale V4 price on its own next successful fetch: no
 * explicit hand-off logic is needed. A V4→no-address transition (still
 * `protocolVersion: 'v4'`) simply freezes `market` at its last
 * successfully-fetched V4 value, matching how `protocol` already freezes
 * for the identical scenario.
 */
const FALLBACK_ERROR_MESSAGE = 'Live Aave V4 collateral-risk data is temporarily unavailable.';

export function useAaveV4CollateralRiskLiveSync(portfolioId: string | null): void {
  const status = useAaveV4CollateralRiskLiveDataStore((state) => state.status);
  const canonical = useAaveV4CollateralRiskLiveDataStore((state) => state.canonical);
  const fetchedUserAddress = useAaveV4CollateralRiskLiveDataStore((state) => state.userAddress);
  const errorMessage = useAaveV4CollateralRiskLiveDataStore((state) => state.errorMessage);
  const errorCode = useAaveV4CollateralRiskLiveDataStore((state) => state.errorCode);
  const attemptedUserAddress = useAaveV4CollateralRiskLiveDataStore(
    (state) => state.attemptedUserAddress,
  );
  const fetchAaveV4CollateralRiskLiveData = useAaveV4CollateralRiskLiveDataStore(
    (state) => state.fetchAaveV4CollateralRiskLiveData,
  );
  const setAaveV4CollateralRisk = usePortfolioStore((state) => state.setAaveV4CollateralRisk);
  const setAaveV4CollateralRiskCandidate = usePortfolioStore(
    (state) => state.setAaveV4CollateralRiskCandidate,
  );
  const setAaveV4CollateralRiskError = usePortfolioStore(
    (state) => state.setAaveV4CollateralRiskError,
  );
  const update = usePortfolioStore((state) => state.update);
  const portfolio = usePortfolioStore((state) =>
    portfolioId !== null ? state.portfolios[portfolioId]?.portfolio : undefined,
  );

  const userAddress =
    portfolio?.protocolVersion === 'v4' ? portfolio.v4Position?.userAddress : undefined;

  const lastAppliedCanonical = useRef<AaveV4CollateralRiskCanonicalData | null>(null);

  useEffect(() => {
    if (userAddress === undefined) return;
    void fetchAaveV4CollateralRiskLiveData(userAddress);
  }, [fetchAaveV4CollateralRiskLiveData, userAddress]);

  useEffect(() => {
    if (portfolioId === null || portfolio === undefined) return;

    if (userAddress === undefined) {
      // No identity to sync against — see this hook's own "Clears on
      // identity removal" header comment. Only clears a previously
      // `'live'`-sourced value that is now orphaned by the identity's
      // removal — NEVER a `'manual'` one (V4 Readiness Audit §12 Stage
      // 25): manual entries have no dependency on a wallet address at
      // all, by design, so a portfolio with no address and a valid
      // manual `v4CollateralRisk` must be left completely untouched
      // here. Genuine no-op (no Store write, no updatedAt bump) for
      // every portfolio that never had `v4CollateralRisk` set in the
      // first place — V3 portfolios never reach this branch's write.
      if (portfolio.v4CollateralRisk !== undefined && portfolio.v4CollateralRiskSource === 'live') {
        setAaveV4CollateralRisk(portfolioId, undefined);
      }
      // V4 Readiness Audit §12 — P0-1. See `useAaveV4LiveSync.ts`'s own
      // identical comment: an identity that goes away invalidates any
      // pending confirmation candidate, independent of whether the
      // branch above fired (canonical may still be `'manual'`).
      setAaveV4CollateralRiskCandidate(portfolioId, undefined);
      // V4 Readiness Audit §12 — P0-4. Same reasoning as the candidate
      // clear immediately above.
      setAaveV4CollateralRiskError(portfolioId, undefined);
      return;
    }

    if (status === 'error') {
      // V4 Readiness Audit §12 — P0-4. See `useAaveV4LiveSync.ts`'s own
      // identical guard — only attribute this error to the CURRENT
      // portfolio's identity if the failed attempt was actually FOR it.
      if (attemptedUserAddress === userAddress) {
        setAaveV4CollateralRiskError(portfolioId, {
          code: errorCode,
          message: errorMessage ?? FALLBACK_ERROR_MESSAGE,
        });
      }
      return;
    }

    if (status !== 'ready' || canonical === null) return;
    if (fetchedUserAddress !== userAddress) return;
    if (lastAppliedCanonical.current === canonical) return;
    lastAppliedCanonical.current = canonical;

    // A genuinely new fetch just succeeded for this portfolio — clear
    // any previously-displayed error regardless of what happens next.
    setAaveV4CollateralRiskError(portfolioId, undefined);

    // V4 Readiness Audit §12 P1-C — `market.btcPriceUsd` ownership.
    // Independent of collateralFactor's own manual/live gating below:
    // market has no such dimension, so this always applies a genuinely
    // new V4 oracle price, equality-gated like every other market write.
    const nextMarket = { btcPriceUsd: canonical.collateralPriceUsd };
    if (!marketPricesEqual(nextMarket, portfolio.market)) {
      update(portfolioId, { market: nextMarket });
    }

    // `v4CollateralRisk` stays exactly `{collateralFactor,
    // dynamicConfigKey}` — `canonical.collateralPriceUsd` is P1-C's
    // `market` field, not part of this shape (the same "duplicate
    // independently, never cross-import" boundary `AaveV4CollateralRiskConfig`
    // already establishes against the adapter's own canonical type).
    // Narrowed once here so it is never accidentally leaked into
    // `v4CollateralRisk`/the candidate map below.
    const riskConfig = {
      collateralFactor: canonical.collateralFactor,
      dynamicConfigKey: canonical.dynamicConfigKey,
    };

    if (portfolio.v4CollateralRiskSource === 'live') {
      // Established live→live refresh model, unchanged.
      if (aaveV4CollateralRiskEqual(riskConfig, portfolio.v4CollateralRisk)) return;
      setAaveV4CollateralRisk(portfolioId, riskConfig, 'live');
      return;
    }

    // No existing value, or an existing MANUAL value that numerically
    // matches the fetch — auto-adopt, no confirmation (Stage 25's own
    // "identical values transition silently" rule).
    if (
      portfolio.v4CollateralRisk === undefined ||
      aaveV4CollateralRiskEqual(riskConfig, portfolio.v4CollateralRisk)
    ) {
      setAaveV4CollateralRisk(portfolioId, riskConfig, 'live');
      return;
    }

    // An existing MANUAL value that genuinely differs — gate behind
    // confirmation instead of overwriting canonical state.
    setAaveV4CollateralRiskCandidate(portfolioId, riskConfig);
  }, [
    portfolioId,
    portfolio,
    userAddress,
    status,
    canonical,
    fetchedUserAddress,
    errorMessage,
    errorCode,
    attemptedUserAddress,
    setAaveV4CollateralRisk,
    setAaveV4CollateralRiskCandidate,
    setAaveV4CollateralRiskError,
    update,
  ]);
}

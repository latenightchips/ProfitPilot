'use client';

import { useEffect, useRef } from 'react';

import type { AaveV4CollateralRiskCanonicalData } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import { aaveV4CollateralRiskEqual, usePortfolioStore } from '@/stores/portfolioStore';

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
 * explicit requirement) — the one structural difference from
 * `useAaveV4LiveSync`.** That hook leaves a stale `v4DebtState` in place
 * if `v4Position` is later cleared (an accepted, pre-existing gap this
 * stage does not touch — see the Stage 23F report). For collateral risk
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
 */
export function useAaveV4CollateralRiskLiveSync(portfolioId: string | null): void {
  const status = useAaveV4CollateralRiskLiveDataStore((state) => state.status);
  const canonical = useAaveV4CollateralRiskLiveDataStore((state) => state.canonical);
  const fetchedUserAddress = useAaveV4CollateralRiskLiveDataStore((state) => state.userAddress);
  const fetchAaveV4CollateralRiskLiveData = useAaveV4CollateralRiskLiveDataStore(
    (state) => state.fetchAaveV4CollateralRiskLiveData,
  );
  const setAaveV4CollateralRisk = usePortfolioStore((state) => state.setAaveV4CollateralRisk);
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
      // identity removal" header comment. Only acts when there is
      // something to clear, so this is a genuine no-op (no Store write,
      // no updatedAt bump) for every portfolio that never had
      // `v4CollateralRisk` set in the first place — V3 portfolios never
      // reach this branch's write.
      if (portfolio.v4CollateralRisk !== undefined) {
        setAaveV4CollateralRisk(portfolioId, undefined);
      }
      return;
    }

    if (status !== 'ready' || canonical === null) return;
    if (fetchedUserAddress !== userAddress) return;
    if (lastAppliedCanonical.current === canonical) return;

    if (aaveV4CollateralRiskEqual(canonical, portfolio.v4CollateralRisk)) {
      lastAppliedCanonical.current = canonical;
      return;
    }

    lastAppliedCanonical.current = canonical;
    setAaveV4CollateralRisk(portfolioId, canonical);
  }, [
    portfolioId,
    portfolio,
    userAddress,
    status,
    canonical,
    fetchedUserAddress,
    setAaveV4CollateralRisk,
  ]);
}

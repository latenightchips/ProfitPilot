'use client';

import { useEffect } from 'react';

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
 */
export function useAaveV4LiveSync(portfolioId: string | null): void {
  const status = useAaveV4LiveDataStore((state) => state.status);
  const engineInputs = useAaveV4LiveDataStore((state) => state.engineInputs);
  const fetchedUserAddress = useAaveV4LiveDataStore((state) => state.userAddress);
  const fetchedDebtAsset = useAaveV4LiveDataStore((state) => state.debtAsset);
  const fetchAaveV4LiveData = useAaveV4LiveDataStore((state) => state.fetchAaveV4LiveData);
  const setAaveV4DebtState = usePortfolioStore((state) => state.setAaveV4DebtState);
  const portfolio = usePortfolioStore((state) =>
    portfolioId !== null ? state.portfolios[portfolioId]?.portfolio : undefined,
  );

  const userAddress =
    portfolio?.protocolVersion === 'v4' ? portfolio.v4Position?.userAddress : undefined;
  const debtAsset = portfolio?.debt.asset;

  useEffect(() => {
    if (userAddress === undefined || debtAsset === undefined) return;
    void fetchAaveV4LiveData(userAddress, debtAsset);
  }, [fetchAaveV4LiveData, userAddress, debtAsset]);

  useEffect(() => {
    if (portfolioId === null || portfolio === undefined) return;
    if (userAddress === undefined || debtAsset === undefined) return;
    if (status !== 'ready' || engineInputs === null) return;
    if (fetchedUserAddress !== userAddress || fetchedDebtAsset !== debtAsset) return;
    if (aaveV4DebtStateEqual(engineInputs, portfolio.v4DebtState)) return;

    setAaveV4DebtState(portfolioId, engineInputs);
  }, [
    portfolioId,
    portfolio,
    userAddress,
    debtAsset,
    status,
    engineInputs,
    fetchedUserAddress,
    fetchedDebtAsset,
    setAaveV4DebtState,
  ]);
}

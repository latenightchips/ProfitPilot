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

  const lastAppliedEngineInputs = useRef<AaveV4EngineDebtInputsData | null>(null);

  useEffect(() => {
    if (userAddress === undefined || debtAsset === undefined) return;
    void fetchAaveV4LiveData(userAddress, debtAsset);
  }, [fetchAaveV4LiveData, userAddress, debtAsset]);

  useEffect(() => {
    if (portfolioId === null || portfolio === undefined) return;
    if (userAddress === undefined || debtAsset === undefined) return;
    if (status !== 'ready' || engineInputs === null) return;
    if (fetchedUserAddress !== userAddress || fetchedDebtAsset !== debtAsset) return;
    if (lastAppliedEngineInputs.current === engineInputs) return;

    if (aaveV4DebtStateEqual(engineInputs, portfolio.v4DebtState)) {
      lastAppliedEngineInputs.current = engineInputs;
      return;
    }

    lastAppliedEngineInputs.current = engineInputs;
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

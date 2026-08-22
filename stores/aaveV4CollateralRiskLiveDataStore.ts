import { create } from 'zustand';

import type { AaveV4CollateralRiskApiResponse } from '@/app/api/aave/v4-collateral-risk/route';

/**
 * Aave V4 Live Collateral-Risk Data Store — V4 Readiness Audit §12 Stage
 * 23F. Mirrors `stores/aaveV4LiveDataStore.ts`'s own shape and discipline
 * exactly, one concern over, and is deliberately a SEPARATE store rather
 * than a field bolted onto that one.
 *
 * **Why a separate store, not folded into `aaveV4LiveDataStore`.**
 * `infrastructure/protocols/aave/v4/index.ts`'s own `fetchAaveV4CollateralRiskSnapshot`
 * doc comment already established this independence one layer down (a
 * different reserve, potentially a different Hub, its own pinned block) —
 * "coupling the two into one all-or-nothing fetch would mean an existing,
 * already-relied-on debt sync could start failing for a reason that has
 * nothing to do with debt." The same reasoning applies here: a
 * collateral-risk RPC hiccup must never flip the debt-sync store's own
 * `status` to `'error'`, and vice versa.
 *
 * **Keyed by `userAddress` alone, not `userAddress` + an asset.**
 * `aaveV4LiveDataStore` is keyed by `userAddress` + `debtAsset` because
 * the debt reserve genuinely depends on which stablecoin the portfolio
 * borrows. Collateral risk always resolves the same fixed collateral
 * asset (`AAVE_V4_ETHEREUM_MARKET.collateralAsset`, WBTC under this
 * codebase's single-collateral-asset scope) regardless of debt asset, so
 * there is no second identity dimension to key on or guard against.
 *
 * **"On API failure, do not erase existing data"** — identical reasoning
 * to `aaveV4LiveDataStore`'s own header comment: every error-path `set()`
 * call below omits `canonical`/`userAddress`/`lastFetchedAt` entirely, so
 * whatever was last successfully fetched (and when) stays in state under
 * an `'error'` status.
 *
 * **`lastFetchedAt`** — same reasoning as `aaveV4LiveDataStore`'s own
 * field: a V4 collateral-risk read is a single synchronous on-chain
 * snapshot with no independent origin/timestamp of its own, so
 * `utils/protocolStatus.ts` applies the same freshness-window check
 * against this store's own fetch time that it already applies to the
 * debt-sync store's.
 */
export type AaveV4CollateralRiskLiveDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveV4CollateralRiskCanonicalData {
  collateralFactor: number;
  dynamicConfigKey: number;
}

export interface AaveV4CollateralRiskLiveDataState {
  status: AaveV4CollateralRiskLiveDataStatus;
  canonical: AaveV4CollateralRiskCanonicalData | null;
  userAddress: `0x${string}` | null;
  errorMessage: string | null;
  /** V4 Readiness Audit §12 — P0-4. Same role as `AaveV4LiveDataState.errorCode` (`./aaveV4LiveDataStore.ts`), one concern over. */
  errorCode: string | null;
  /** V4 Readiness Audit §12 — P0-4. Same role as `AaveV4LiveDataState.attemptedUserAddress`, one concern over — no `debtAsset` dimension here (this store is keyed by `userAddress` alone). */
  attemptedUserAddress: `0x${string}` | null;
  /** ISO 8601 instant of the last successful fetch — see header comment. */
  lastFetchedAt: string | null;
  fetchAaveV4CollateralRiskLiveData: (userAddress: `0x${string}`) => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = 'Live Aave V4 collateral-risk data is temporarily unavailable.';

let latestRequestId = 0;

export const useAaveV4CollateralRiskLiveDataStore = create<AaveV4CollateralRiskLiveDataState>(
  (set) => ({
    status: 'idle',
    canonical: null,
    userAddress: null,
    errorMessage: null,
    errorCode: null,
    attemptedUserAddress: null,
    lastFetchedAt: null,

    fetchAaveV4CollateralRiskLiveData: async (userAddress: `0x${string}`) => {
      const requestId = ++latestRequestId;
      set({ status: 'loading', attemptedUserAddress: userAddress });

      let body: AaveV4CollateralRiskApiResponse;
      try {
        const response = await fetch(
          `/api/aave/v4-collateral-risk?userAddress=${encodeURIComponent(userAddress)}`,
        );
        body = (await response.json()) as AaveV4CollateralRiskApiResponse;
      } catch {
        if (requestId !== latestRequestId) return;
        set({ status: 'error', errorMessage: GENERIC_ERROR_MESSAGE, errorCode: null });
        return;
      }

      if (requestId !== latestRequestId) return;

      if (!body.ok || body.data === undefined) {
        set({
          status: 'error',
          errorMessage: body.errors?.[0]?.message ?? GENERIC_ERROR_MESSAGE,
          errorCode: body.errors?.[0]?.code ?? null,
        });
        return;
      }

      set({
        status: 'ready',
        canonical: body.data.canonical,
        userAddress,
        errorMessage: null,
        errorCode: null,
        lastFetchedAt: new Date().toISOString(),
      });
    },
  }),
);

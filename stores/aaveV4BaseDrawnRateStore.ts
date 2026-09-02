import { create } from 'zustand';

import type { AaveV4BaseDrawnRateApiResponse } from '@/app/api/aave/v4-base-drawn-rate/route';

/**
 * Aave V4 Base-Drawn-Rate Live Data Store — closes the "V4 portfolio
 * creation always requires an on-chain address before the market's own
 * base drawn rate can become live" finding (V4 Manual-Data / Provenance
 * Audit). Mirrors `./aaveV4ReservePriceStore.ts`'s own shape and
 * discipline exactly, one field over — that store is keyed by nothing
 * (one fixed collateral asset); this one is keyed by `debtAsset` alone,
 * never a wallet address, since the base drawn rate genuinely varies per
 * debt asset (USDC/USDT/DAI resolve to different reserves) but never per
 * user.
 *
 * **Why a separate store, not folded into `aaveV4LiveDataStore`.** That
 * store's own `fetchAaveV4LiveData` requires a `userAddress` and reports
 * wallet-scoped `drawnDebt`/`premiumDebt`/`riskPremium` alongside its own
 * `baseDrawnApr` — genuinely wallet-scoped state, keyed by identity
 * (address + debt asset). This store's own fetch takes only a debt asset:
 * the market's base rate is a property of the Hub/reserve alone, never
 * the wallet. Keeping it a separate store means a portfolio-creation
 * caller can fetch a live base rate the instant a debt asset is chosen,
 * with no address typed yet — exactly the gap this store closes — while
 * the wallet-scoped store stays completely unchanged and still owns
 * `drawnDebt`/`premiumDebt`/`riskPremium`.
 *
 * **"On API failure, do not erase existing data"** — identical reasoning
 * to every sibling V4 store's own header comment: the error-path `set()`
 * call below omits `canonical`/`lastFetchedAt` entirely, so whatever was
 * last successfully fetched (and when) stays in state under an
 * `'error'` status.
 *
 * **`lastFetchedAt`** — same reasoning as the sibling V4 stores: a V4
 * base-drawn-rate read is a single synchronous on-chain snapshot with no
 * independent origin/timestamp of its own, so `utils/aaveDataStatus.ts`-
 * style freshness checks can apply the same window against this store's
 * own fetch time that they already apply elsewhere.
 */
export type AaveV4BaseDrawnRateStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveV4BaseDrawnRateCanonicalData {
  baseDrawnApr: number;
}

export interface AaveV4BaseDrawnRateState {
  status: AaveV4BaseDrawnRateStatus;
  canonical: AaveV4BaseDrawnRateCanonicalData | null;
  debtAsset: string | null;
  errorMessage: string | null;
  errorCode: string | null;
  /** ISO 8601 instant of the last successful fetch — see header comment. */
  lastFetchedAt: string | null;
  fetchAaveV4BaseDrawnRate: (debtAsset: string) => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = 'Live Aave V4 base drawn rate data is temporarily unavailable.';

let latestRequestId = 0;

export const useAaveV4BaseDrawnRateStore = create<AaveV4BaseDrawnRateState>((set) => ({
  status: 'idle',
  canonical: null,
  debtAsset: null,
  errorMessage: null,
  errorCode: null,
  lastFetchedAt: null,

  fetchAaveV4BaseDrawnRate: async (debtAsset: string) => {
    const requestId = ++latestRequestId;
    set({ status: 'loading' });

    let body: AaveV4BaseDrawnRateApiResponse;
    try {
      const response = await fetch(
        `/api/aave/v4-base-drawn-rate?debtAsset=${encodeURIComponent(debtAsset)}`,
      );
      body = (await response.json()) as AaveV4BaseDrawnRateApiResponse;
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
      debtAsset,
      errorMessage: null,
      errorCode: null,
      lastFetchedAt: new Date().toISOString(),
    });
  },
}));

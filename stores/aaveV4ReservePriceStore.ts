import { create } from 'zustand';

import type { AaveV4ReservePriceApiResponse } from '@/app/api/aave/v4-reserve-price/route';

/**
 * Aave V4 Reserve-Price Live Data Store — closes the "V4 new-portfolio
 * creation requires an on-chain address before BTC price can become
 * live" finding. Mirrors `./aaveV4CollateralRiskLiveDataStore.ts`'s own
 * shape and discipline exactly, one concern over, and is deliberately a
 * SEPARATE store rather than a field bolted onto that one.
 *
 * **Why a separate store, not folded into `aaveV4CollateralRiskLiveDataStore`.**
 * That store's own `fetchAaveV4CollateralRiskLiveData` requires a
 * `userAddress` and reports `collateralFactor`/`dynamicConfigKey`
 * alongside its own `collateralPriceUsd` — genuinely wallet-scoped
 * state. This store's own fetch takes NO arguments at all: the
 * collateral reserve's oracle price is a property of the Spoke/reserve
 * alone, never the wallet. Keeping it a separate store means a
 * portfolio-creation caller can fetch a live BTC price the instant V4 is
 * selected, with no address typed yet — exactly the gap this store
 * closes — while the wallet-scoped store above stays completely
 * unchanged and still owns `collateralFactor`/`dynamicConfigKey`.
 *
 * **"On API failure, do not erase existing data"** — identical reasoning
 * to `aaveV4CollateralRiskLiveDataStore`'s own header comment: the
 * error-path `set()` call below omits `canonical`/`lastFetchedAt`
 * entirely, so whatever was last successfully fetched (and when) stays
 * in state under an `'error'` status.
 *
 * **`lastFetchedAt`** — same reasoning as the sibling V4 stores: a V4
 * reserve-price read is a single synchronous on-chain snapshot with no
 * independent origin/timestamp of its own, so `utils/aaveDataStatus.ts`-
 * style freshness checks can apply the same window against this store's
 * own fetch time that they already apply elsewhere.
 */
export type AaveV4ReservePriceStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveV4ReservePriceCanonicalData {
  collateralPriceUsd: number;
}

export interface AaveV4ReservePriceState {
  status: AaveV4ReservePriceStatus;
  canonical: AaveV4ReservePriceCanonicalData | null;
  errorMessage: string | null;
  errorCode: string | null;
  /** ISO 8601 instant of the last successful fetch — see header comment. */
  lastFetchedAt: string | null;
  fetchAaveV4ReservePrice: () => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = 'Live Aave V4 price data is temporarily unavailable.';

let latestRequestId = 0;

export const useAaveV4ReservePriceStore = create<AaveV4ReservePriceState>((set) => ({
  status: 'idle',
  canonical: null,
  errorMessage: null,
  errorCode: null,
  lastFetchedAt: null,

  fetchAaveV4ReservePrice: async () => {
    const requestId = ++latestRequestId;
    set({ status: 'loading' });

    let body: AaveV4ReservePriceApiResponse;
    try {
      const response = await fetch('/api/aave/v4-reserve-price');
      body = (await response.json()) as AaveV4ReservePriceApiResponse;
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
      errorMessage: null,
      errorCode: null,
      lastFetchedAt: new Date().toISOString(),
    });
  },
}));

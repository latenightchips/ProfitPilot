import { create } from 'zustand';

import type { AaveV4PositionApiResponse } from '@/app/api/aave/v4-position/route';

/**
 * Aave V4 Live Data Store — V4 Readiness Audit §12 Stage 7. Mirrors
 * `stores/aaveLiveDataStore.ts`'s own shape and discipline exactly, one
 * layer down: fetches from the same-origin `/api/aave/v4-position` Route
 * Handler (Stage 4B) — never the Aave V4 contracts directly from the
 * browser, the RPC call happens server-side, see that route's own header
 * comment.
 *
 * **Keyed by identity (`userAddress` + `debtAsset`), not just asset.**
 * `useAaveLiveDataStore` only needed an asset-switch guard because V3's
 * identity is implicit (there is no per-wallet V3 read). V4 genuinely
 * reads a specific wallet's position, so a stale in-flight response must
 * be rejected if EITHER the address or the asset has since changed —
 * `hooks/useAaveV4LiveSync.ts`'s own sync effect re-checks both
 * `userAddress`/`debtAsset` against the calling portfolio's current
 * configuration before ever writing this store's `engineInputs` into
 * portfolio state, the same "preserve wallet/chain/market position
 * identity boundaries" requirement this stage was given. The
 * `latestRequestId` guard below additionally protects against a stale
 * in-flight response landing after a *newer* request already resolved,
 * mirroring `useAaveLiveDataStore`'s own request-id guard.
 *
 * **"On API failure, do not erase existing data"** — identical
 * reasoning to `useAaveLiveDataStore`'s own header comment: every
 * error-path `set()` call below omits `engineInputs`/`userAddress`/
 * `debtAsset` entirely, so whatever was last successfully fetched stays
 * in state under an `'error'` status.
 */
export type AaveV4LiveDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveV4EngineDebtInputsData {
  drawnDebt: number;
  premiumDebt: number;
  baseDrawnApr: number;
  riskPremium: number;
}

export interface AaveV4LiveDataState {
  status: AaveV4LiveDataStatus;
  engineInputs: AaveV4EngineDebtInputsData | null;
  userAddress: `0x${string}` | null;
  debtAsset: string | null;
  errorMessage: string | null;
  fetchAaveV4LiveData: (userAddress: `0x${string}`, debtAsset: string) => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = 'Live Aave V4 data is temporarily unavailable.';

let latestRequestId = 0;

export const useAaveV4LiveDataStore = create<AaveV4LiveDataState>((set) => ({
  status: 'idle',
  engineInputs: null,
  userAddress: null,
  debtAsset: null,
  errorMessage: null,

  fetchAaveV4LiveData: async (userAddress: `0x${string}`, debtAsset: string) => {
    const requestId = ++latestRequestId;
    set({ status: 'loading' });

    let body: AaveV4PositionApiResponse;
    try {
      const response = await fetch(
        `/api/aave/v4-position?userAddress=${encodeURIComponent(userAddress)}&debtAsset=${encodeURIComponent(debtAsset)}`,
      );
      body = (await response.json()) as AaveV4PositionApiResponse;
    } catch {
      if (requestId !== latestRequestId) return;
      set({ status: 'error', errorMessage: GENERIC_ERROR_MESSAGE });
      return;
    }

    if (requestId !== latestRequestId) return;

    if (!body.ok || body.data === undefined) {
      set({ status: 'error', errorMessage: body.errors?.[0]?.message ?? GENERIC_ERROR_MESSAGE });
      return;
    }

    set({
      status: 'ready',
      engineInputs: body.data.engineInputs,
      userAddress,
      debtAsset,
      errorMessage: null,
    });
  },
}));

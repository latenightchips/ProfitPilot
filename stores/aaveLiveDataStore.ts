import { create } from 'zustand';

import type { AaveReserveApiResponse } from '@/app/api/aave/reserve/route';
import { normalizeMarketQuote, normalizeProtocolQuote } from '@/services';
import type { MarketQuote } from '@/services/market/quote';
import type { ProtocolQuote } from '@/services/protocol/quote';

/**
 * Aave Live Data Store — Phase 1 read-only live-data integration.
 * Fetches from the same-origin `/api/aave/reserve` Route Handler (never
 * the Aave subgraph / The Graph directly — the API key stays
 * server-side, see that route's own header comment).
 *
 * **"On API failure, do not erase existing manual values" / never lose
 * the last-good fetch**: every error-path `set()` call below omits
 * `marketQuote`/`protocolQuote` entirely. Zustand's `set()` shallow-
 * merges by default, so whatever was last successfully fetched stays in
 * state under an `'error'` status — `LiveAaveDataPanel.tsx` renders
 * that last-known data alongside a "couldn't refresh" notice rather
 * than losing it.
 */
export type AaveLiveDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveLiveDataState {
  status: AaveLiveDataStatus;
  marketQuote: MarketQuote | null;
  protocolQuote: ProtocolQuote | null;
  collateralSymbol: string | null;
  borrowSymbol: string | null;
  errorMessage: string | null;
  fetchLiveAaveData: () => Promise<void>;
}

const GENERIC_ERROR_MESSAGE = 'Live Aave data is temporarily unavailable.';

export const useAaveLiveDataStore = create<AaveLiveDataState>((set) => ({
  status: 'idle',
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  errorMessage: null,

  fetchLiveAaveData: async () => {
    set({ status: 'loading' });

    let body: AaveReserveApiResponse;
    try {
      const response = await fetch('/api/aave/reserve');
      body = (await response.json()) as AaveReserveApiResponse;
    } catch {
      set({ status: 'error', errorMessage: GENERIC_ERROR_MESSAGE });
      return;
    }

    if (!body.ok || body.data === undefined) {
      set({ status: 'error', errorMessage: body.error?.userMessage ?? GENERIC_ERROR_MESSAGE });
      return;
    }

    const { priceCandidate, protocolCandidate, collateralSymbol, borrowSymbol } = body.data;

    const marketResult = normalizeMarketQuote({
      asset: 'BTC',
      currency: 'USD',
      candidates: [priceCandidate],
      now: new Date().toISOString(),
    });
    const protocolResult = normalizeProtocolQuote({
      collateralAsset: collateralSymbol,
      borrowAsset: borrowSymbol,
      candidates: [protocolCandidate],
    });

    if (!marketResult.ok || !protocolResult.ok) {
      set({ status: 'error', errorMessage: GENERIC_ERROR_MESSAGE });
      return;
    }

    set({
      status: 'ready',
      marketQuote: marketResult.data,
      protocolQuote: protocolResult.data,
      collateralSymbol,
      borrowSymbol,
      errorMessage: null,
    });
  },
}));

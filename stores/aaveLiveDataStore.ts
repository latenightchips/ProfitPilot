import { create } from 'zustand';

import type { AaveReserveApiResponse } from '@/app/api/aave/reserve/route';
import type { AaveSourceMetadata } from '@/infrastructure/protocols/aave';
import { normalizeMarketQuote, normalizeProtocolQuote } from '@/services';
import type { MarketQuote } from '@/services/market/quote';
import type { ProtocolQuote } from '@/services/protocol/quote';

/**
 * Aave Live Data Store — direct-RPC live-data integration. Fetches from
 * the same-origin `/api/aave/reserve` Route Handler (never the Aave
 * contracts directly from the browser — the RPC call happens server-side,
 * see that route's own header comment).
 *
 * **"On API failure, do not erase existing manual values" / never lose
 * the last-good fetch**: every error-path `set()` call below omits
 * `marketQuote`/`protocolQuote`/`source` entirely. Zustand's `set()`
 * shallow-merges by default, so whatever was last successfully fetched
 * stays in state under an `'error'` status — consumers (Portfolio page,
 * Dashboard) render that last-known data alongside a "couldn't refresh"
 * notice rather than losing it. `hooks/useAaveLiveSync.ts` relies on this
 * same guarantee to leave a portfolio's stored `market`/`protocol` values
 * untouched (never blanked/zeroed) whenever a refresh fails.
 *
 * **`source` (Portfolio Live-State Cleanup batch)** — the adapter's
 * `AaveSourceMetadata` (protocol/version/network/method/blockNumber),
 * surfaced for the Developer-Mode-gated "Technical details" block. Not
 * used for any calculation or freshness classification — `marketQuote`'s
 * own `freshness` field (via `normalizeMarketQuote`'s existing 5-minute
 * rule) remains the single source of truth for Live/Stale/Unavailable
 * status, shared by both price and protocol display since both are
 * fetched together in one request.
 */
export type AaveLiveDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface AaveLiveDataState {
  status: AaveLiveDataStatus;
  marketQuote: MarketQuote | null;
  protocolQuote: ProtocolQuote | null;
  collateralSymbol: string | null;
  borrowSymbol: string | null;
  source: AaveSourceMetadata | null;
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
  source: null,
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

    const { priceCandidate, protocolCandidate, collateralSymbol, borrowSymbol, source } = body.data;

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
      source,
      errorMessage: null,
    });
  },
}));

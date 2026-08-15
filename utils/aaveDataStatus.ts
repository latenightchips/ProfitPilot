import type { MarketQuote } from '@/services/market/quote';

/**
 * Live/Stale/Unavailable status — Portfolio Live-State Cleanup batch.
 * Purely UI-derived from `useAaveLiveDataStore`'s own `marketQuote`
 * (via `services/market/quote.ts`'s existing 5-minute freshness rule) —
 * no new business rule, no persisted "source" field on `Portfolio`.
 * `protocolQuote` has no independent freshness concept (see
 * `services/protocol/quote.ts`'s own header comment), so protocol
 * staleness is inferred by reusing the market quote's freshness: both
 * are fetched together in one `/api/aave/reserve` request.
 */
export type AaveDataStatus = 'live' | 'stale' | 'unavailable';

export function deriveAaveDataStatus(marketQuote: MarketQuote | null): AaveDataStatus {
  if (marketQuote === null || marketQuote.freshness === 'unavailable') return 'unavailable';
  return marketQuote.freshness === 'fresh' ? 'live' : 'stale';
}

export function formatAaveDataStatus(status: AaveDataStatus): string {
  switch (status) {
    case 'live':
      return 'Aave V3 · Live';
    case 'stale':
      return 'Aave V3 · Stale';
    case 'unavailable':
      return 'Aave V3 · Unavailable (showing last known value)';
  }
}

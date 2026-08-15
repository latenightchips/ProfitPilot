import { describe, expect, it } from 'vitest';

import type { MarketQuote, MarketQuoteAvailable } from '@/services/market/quote';
import { deriveAaveDataStatus, formatAaveDataStatus } from '@/utils/aaveDataStatus';

function freshQuote(): MarketQuoteAvailable {
  return {
    asset: 'BTC',
    currency: 'USD',
    freshness: 'fresh',
    price: 65000,
    origin: 'provider',
    timestamp: new Date().toISOString(),
  };
}

function staleQuote(): MarketQuote {
  return { ...freshQuote(), freshness: 'stale' };
}

function unavailableQuote(): MarketQuote {
  return { asset: 'BTC', currency: 'USD', freshness: 'unavailable' };
}

describe('deriveAaveDataStatus — Live/Stale/Unavailable presentation', () => {
  it('reports "live" for a fresh quote', () => {
    expect(deriveAaveDataStatus(freshQuote())).toBe('live');
  });

  it('reports "stale" for a stale quote', () => {
    expect(deriveAaveDataStatus(staleQuote())).toBe('stale');
  });

  it('reports "unavailable" for an unavailable quote', () => {
    expect(deriveAaveDataStatus(unavailableQuote())).toBe('unavailable');
  });

  it('reports "unavailable" when no quote has ever been fetched (null)', () => {
    expect(deriveAaveDataStatus(null)).toBe('unavailable');
  });
});

describe('formatAaveDataStatus — labels', () => {
  it('labels live data clearly', () => {
    expect(formatAaveDataStatus('live')).toBe('Aave V3 · Live');
  });

  it('labels stale data clearly, distinct from live', () => {
    expect(formatAaveDataStatus('stale')).toBe('Aave V3 · Stale');
  });

  it('labels unavailable data clearly, noting the value shown is a last-known value', () => {
    const label = formatAaveDataStatus('unavailable');
    expect(label).toContain('Unavailable');
    expect(label).toContain('last known value');
  });

  it('produces three distinct labels', () => {
    const labels = new Set([
      formatAaveDataStatus('live'),
      formatAaveDataStatus('stale'),
      formatAaveDataStatus('unavailable'),
    ]);
    expect(labels.size).toBe(3);
  });
});

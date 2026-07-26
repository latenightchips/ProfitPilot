import { describe, expect, it } from 'vitest';

import type { NormalizeMarketQuoteInput, RawPriceCandidate } from '@/services/market/quote';
import { normalizeMarketQuote } from '@/services/market/quote';

/**
 * Market Data Service — 06_TASKS.md M3-007.
 *
 * `now` is fixed at 2026-01-01T00:10:00.000Z throughout; candidate
 * timestamps are chosen relative to it so freshness (5-minute threshold,
 * `04_BUILD_GUIDE.md` "PRICE FRESHNESS") resolves to exact, unambiguous
 * boundaries.
 */
const NOW = '2026-01-01T00:10:00.000Z';

function baseInput(overrides: Partial<NormalizeMarketQuoteInput> = {}): NormalizeMarketQuoteInput {
  return {
    asset: 'BTC',
    currency: 'USD',
    candidates: [],
    now: NOW,
    ...overrides,
  };
}

describe('normalizeMarketQuote (M3-007)', () => {
  it('classifies a provider price 4 minutes old as fresh', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 65000, timestamp: '2026-01-01T00:06:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      asset: 'BTC',
      currency: 'USD',
      freshness: 'fresh',
      price: 65000,
      origin: 'provider',
      timestamp: '2026-01-01T00:06:00.000Z',
    });
  });

  it('classifies a provider price 6 minutes old as stale', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 65000, timestamp: '2026-01-01T00:04:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.freshness).toBe('stale');
  });

  it('treats exactly 5 minutes old as fresh (boundary is "older than 5 minutes")', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 65000, timestamp: '2026-01-01T00:05:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.freshness).toBe('fresh');
  });

  it('treats 5 minutes and 1 second old as stale', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 65000, timestamp: '2026-01-01T00:04:59.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.freshness).toBe('stale');
  });

  it('falls back to cache when no provider candidate exists', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'cache', price: 64000, timestamp: '2026-01-01T00:08:00.000Z' },
      { origin: 'manual', price: 63000, timestamp: '2026-01-01T00:00:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.freshness).not.toBe('unavailable');
    if (result.data.freshness === 'unavailable') return;
    expect(result.data.origin).toBe('cache');
    expect(result.data.price).toBe(64000);
  });

  it('falls back to manual when neither provider nor cache candidates exist', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'manual', price: 62000, timestamp: '2026-01-01T00:09:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.freshness).not.toBe('unavailable');
    if (result.data.freshness === 'unavailable') return;
    expect(result.data.origin).toBe('manual');
    expect(result.data.price).toBe(62000);
  });

  it('prefers provider over cache and manual even when all three are present', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'manual', price: 1, timestamp: '2026-01-01T00:09:00.000Z' },
      { origin: 'cache', price: 2, timestamp: '2026-01-01T00:09:00.000Z' },
      { origin: 'provider', price: 65000, timestamp: '2026-01-01T00:00:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.freshness).not.toBe('unavailable');
    if (result.data.freshness === 'unavailable') return;
    // Provider is chosen (and reported stale) even though cache/manual are fresher.
    expect(result.data.origin).toBe('provider');
    expect(result.data.price).toBe(65000);
    expect(result.data.freshness).toBe('stale');
  });

  it('returns a successful "unavailable" quote (not a failure) when no candidates exist', () => {
    const result = normalizeMarketQuote(baseInput({ candidates: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({ asset: 'BTC', currency: 'USD', freshness: 'unavailable' });
    expect('price' in result.data).toBe(false);
    expect('origin' in result.data).toBe(false);
  });

  it('does not have an errors field on a success result (discriminated union, not a nullable envelope)', () => {
    const result = normalizeMarketQuote(baseInput({ candidates: [] }));
    expect('errors' in result).toBe(false);
  });

  it('does not have a data field on a failure result (discriminated union, not a nullable envelope)', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: -1, timestamp: '2026-01-01T00:09:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    expect('data' in result).toBe(false);
  });

  it('fails validation for a non-positive price', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 0, timestamp: '2026-01-01T00:09:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({
      category: 'validation',
      code: 'MARKET_QUOTE_PRICE_INVALID',
    });
  });

  it('fails validation for a non-finite price', () => {
    const candidates: RawPriceCandidate[] = [
      {
        origin: 'provider',
        price: Number.POSITIVE_INFINITY,
        timestamp: '2026-01-01T00:09:00.000Z',
      },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'MARKET_QUOTE_PRICE_INVALID' });
  });

  it('fails validation for an unparseable candidate timestamp', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 65000, timestamp: 'not-a-date' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'MARKET_QUOTE_TIMESTAMP_INVALID' });
  });

  it('fails validation for an unparseable "now"', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: 65000, timestamp: '2026-01-01T00:09:00.000Z' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates, now: 'not-a-date' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toMatchObject({ code: 'MARKET_QUOTE_NOW_INVALID' });
  });

  it('aggregates errors from multiple malformed candidates rather than stopping at the first', () => {
    const candidates: RawPriceCandidate[] = [
      { origin: 'provider', price: -1, timestamp: '2026-01-01T00:09:00.000Z' },
      { origin: 'manual', price: 65000, timestamp: 'not-a-date' },
    ];
    const result = normalizeMarketQuote(baseInput({ candidates }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toHaveLength(2);
    const codes = result.errors.map((error) => error.code);
    expect(codes).toContain('MARKET_QUOTE_PRICE_INVALID');
    expect(codes).toContain('MARKET_QUOTE_TIMESTAMP_INVALID');
  });

  it('carries the requested asset and currency through to the quote', () => {
    const result = normalizeMarketQuote(
      baseInput({ asset: 'ETH', currency: 'EUR', candidates: [] }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.asset).toBe('ETH');
    expect(result.data.currency).toBe('EUR');
  });
});

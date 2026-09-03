import { describe, expect, it } from 'vitest';

import type { DashboardFreshness } from '@/features/dashboard';
import { buildDataFreshnessIndicators } from '@/features/dashboard';

/**
 * Data Freshness Indicators builder — 06_TASKS.md M5-017.
 */
const FRESH_MARKET: DashboardFreshness['market'] = {
  price: 50000,
  formattedPrice: '$50,000.00',
  origin: 'manual',
  freshness: 'fresh',
  updatedAt: '2026-07-26T00:00:00.000Z',
  formattedUpdatedAt: 'Jul 26, 2026, 12:00 AM',
};

const STALE_MARKET: DashboardFreshness['market'] = {
  ...FRESH_MARKET,
  freshness: 'stale',
};

const PROTOCOL: DashboardFreshness['protocol'] = {
  origin: 'manual',
  updatedAt: '2026-07-26T00:00:00.000Z',
  formattedUpdatedAt: 'Jul 26, 2026, 12:00 AM',
};

describe('buildDataFreshnessIndicators — market and protocol both available', () => {
  it('maps fresh market data and reports no freshness classification for protocol data', () => {
    const result = buildDataFreshnessIndicators({ market: FRESH_MARKET, protocol: PROTOCOL }, 'v3');

    expect(result.market).toEqual({
      label: 'BTC Price',
      source: 'manual',
      isManual: true,
      formattedUpdatedAt: 'Jul 26, 2026, 12:00 AM',
      freshnessLabel: 'Fresh',
    });
    expect(result.protocol).toEqual({
      label: 'Protocol Parameters',
      source: 'manual',
      isManual: true,
      formattedUpdatedAt: 'Jul 26, 2026, 12:00 AM',
      freshnessLabel: null,
    });
    expect(result.refreshNote.length).toBeGreaterThan(0);
  });

  it('maps stale market data', () => {
    const result = buildDataFreshnessIndicators({ market: STALE_MARKET, protocol: PROTOCOL }, 'v3');
    expect(result.market?.freshnessLabel).toBe('Stale');
  });
});

describe('buildDataFreshnessIndicators — practically-unreachable unavailable cases', () => {
  it('returns null for both when freshness is null', () => {
    const result = buildDataFreshnessIndicators({ market: null, protocol: null }, 'v3');
    expect(result.market).toBeNull();
    expect(result.protocol).toBeNull();
  });
});

describe('buildDataFreshnessIndicators — V3/V4 refreshNote dispatch (Dashboard V3/V4 Semantic Isolation audit)', () => {
  it('names "Aave V3" in the refresh note for a V3 (or unset) portfolio — byte-identical to before this audit', () => {
    const resultUnset = buildDataFreshnessIndicators(
      { market: FRESH_MARKET, protocol: PROTOCOL },
      undefined,
    );
    const resultV3 = buildDataFreshnessIndicators(
      { market: FRESH_MARKET, protocol: PROTOCOL },
      'v3',
    );
    expect(resultUnset.refreshNote).toBe(
      '"Refresh" fetches the latest Aave V3 live snapshot and recalculates your portfolio summary — it cannot fail in a way that erases or replaces your collateral quantity, debt asset, or debt amount.',
    );
    expect(resultV3.refreshNote).toBe(resultUnset.refreshNote);
  });

  it('never names "Aave V3" in the refresh note for a V4 portfolio', () => {
    const result = buildDataFreshnessIndicators({ market: FRESH_MARKET, protocol: null }, 'v4');
    expect(result.refreshNote).not.toContain('Aave V3');
    expect(result.refreshNote.length).toBeGreaterThan(0);
  });

  it('describes the real V4 mechanism (background sync, not the Refresh button) rather than reusing V3 wording', () => {
    const result = buildDataFreshnessIndicators({ market: FRESH_MARKET, protocol: null }, 'v4');
    expect(result.refreshNote).toContain('Aave V4');
    expect(result.refreshNote).toContain('automatically');
  });
});

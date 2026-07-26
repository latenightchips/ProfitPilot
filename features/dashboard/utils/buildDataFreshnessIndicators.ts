/**
 * Data Freshness Indicators builder — 06_TASKS.md M5-017 (and its
 * resolution of M5-018 — see `../types/dataFreshnessIndicators.ts` for
 * the full reasoning on both).
 */
import type { DataFreshnessIndicators, FreshnessIndicator } from '../types/dataFreshnessIndicators';
import type { DashboardFreshness } from '../types/viewModel';

export const REFRESH_NOTE =
  'This application runs in Manual Mode: no live price or protocol data provider is connected. "Refresh" recalculates your portfolio summary using the values you last entered — it does not fetch new data, and it cannot fail in a way that erases or replaces your existing entries.';

function toIndicator(
  label: string,
  freshness: DashboardFreshness['market'] | DashboardFreshness['protocol'],
): FreshnessIndicator | null {
  if (freshness === null) return null;
  return {
    label,
    source: freshness.origin,
    isManual: freshness.origin === 'manual',
    formattedUpdatedAt: freshness.formattedUpdatedAt,
    freshnessLabel:
      'freshness' in freshness ? (freshness.freshness === 'fresh' ? 'Fresh' : 'Stale') : null,
  };
}

export function buildDataFreshnessIndicators(
  freshness: DashboardFreshness,
): DataFreshnessIndicators {
  return {
    market: toIndicator('BTC Price', freshness.market),
    protocol: toIndicator('Protocol Parameters', freshness.protocol),
    refreshNote: REFRESH_NOTE,
  };
}

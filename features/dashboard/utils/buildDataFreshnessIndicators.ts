/**
 * Data Freshness Indicators builder — 06_TASKS.md M5-017 (and its
 * resolution of M5-018 — see `../types/dataFreshnessIndicators.ts` for
 * the full reasoning on both).
 */
import type { DataFreshnessIndicators, FreshnessIndicator } from '../types/dataFreshnessIndicators';
import type { DashboardFreshness } from '../types/viewModel';

/**
 * Dashboard Live-State Cleanup batch: `DashboardSummaryHeader`'s
 * "Refresh" button now genuinely fetches a live Aave V3 snapshot
 * (`useAaveLiveDataStore.fetchLiveAaveData`, via
 * `hooks/useAaveLiveSync.ts`'s equality-gated sync) in addition to
 * recalculating the summary — this note must say so, not retain the
 * older "does not fetch new Aave data" claim from before that
 * integration existed. "Cannot erase or replace your existing entries"
 * remains true: the sync path this button triggers only ever writes
 * `market`/`protocol`, never `collateral`/`debt` (see
 * `hooks/useAaveLiveSync.ts`'s own header comment).
 */
export const REFRESH_NOTE =
  '"Refresh" fetches the latest Aave V3 live snapshot and recalculates your portfolio summary — it cannot fail in a way that erases or replaces your collateral quantity, debt asset, or debt amount.';

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

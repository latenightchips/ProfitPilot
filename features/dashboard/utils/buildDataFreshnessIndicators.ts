/**
 * Data Freshness Indicators builder — 06_TASKS.md M5-017 (and its
 * resolution of M5-018 — see `../types/dataFreshnessIndicators.ts` for
 * the full reasoning on both).
 */
import type { Portfolio } from '@/types/portfolio';

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
 *
 * **V3-only, byte-identical (Dashboard V3/V4 Semantic Isolation
 * audit).** This string names "Aave V3" explicitly and describes exactly
 * one button action (`fetchLiveAaveData`, a V3-only fetch) — showing it
 * unconditionally on a V4 portfolio's Dashboard would claim a V3 sync
 * mechanism as if it were the relevant one. It is not: V4 debt/
 * collateral-risk data already syncs independently and automatically in
 * the background the moment the Dashboard mounts (`useAaveV4Sync`,
 * `app/DashboardPageClient.tsx`), with no button press required at all.
 */
export const V3_REFRESH_NOTE =
  '"Refresh" fetches the latest Aave V3 live snapshot and recalculates your portfolio summary — it cannot fail in a way that erases or replaces your collateral quantity, debt asset, or debt amount.';

/**
 * V4 counterpart — Dashboard V3/V4 Semantic Isolation audit. Describes
 * what the Refresh button actually does for a V4 portfolio (recalculates
 * the summary from already-synced data; never fetches Aave V3 data, and
 * never needs to, since V4 sync already runs independently in the
 * background — see `V3_REFRESH_NOTE`'s own comment above) rather than
 * reusing V3-specific wording that names a mechanism V4 does not use.
 */
export const V4_REFRESH_NOTE =
  '"Refresh" recalculates your portfolio summary from your currently synced Aave V4 data — it cannot fail in a way that erases or replaces your collateral quantity, debt asset, or debt amount. Aave V4 debt and collateral-risk data syncs automatically in the background; sync a new position from the Portfolio page.';

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
  protocolVersion: Portfolio['protocolVersion'],
): DataFreshnessIndicators {
  return {
    market: toIndicator('BTC Price', freshness.market),
    protocol: toIndicator('Protocol Parameters', freshness.protocol),
    refreshNote: protocolVersion === 'v4' ? V4_REFRESH_NOTE : V3_REFRESH_NOTE,
  };
}

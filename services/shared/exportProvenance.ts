import { isTimestampStale } from '@/utils/protocolStatus';

import type { ApplicationPortfolio } from '../portfolio/models';

/**
 * Export provenance metadata — V4 Readiness Audit §12 P2-1. The single
 * shared implementation every exporter (Loop Strategy, Exit Plan,
 * Simulation, CSV) calls, so "was this export's V4 data live, manual, or
 * stale at the moment of export" can never disagree between formats — the
 * same "one shared resolver, not N independently-invented copies"
 * discipline `resolveExecutionCostAssumptions` (this same directory)
 * already established for execution-cost assumptions.
 *
 * Deliberately reads only the portfolio's own already-persisted fields
 * (`protocolVersion`, `v4DebtStateSource`/`v4CollateralRiskSource`,
 * `v4DebtStateUpdatedAt`/`v4CollateralRiskUpdatedAt`) — never the
 * transient live-data Zustand stores (`useAaveV4LiveDataStore`/
 * `useAaveV4CollateralRiskLiveDataStore`), so an export built from a
 * portfolio alone (no live-data-store access, e.g. a test or a future
 * server-side export) produces the same honest answer a UI-triggered
 * export does. `null`, never a fabricated value, for anything not
 * currently known — the same "unavailable ≠ fake value" discipline this
 * stage's own instructions require throughout.
 *
 * `v4DataStaleAtExport` answers this stage's own explicit question —
 * "whether exported LIVE data was stale/unknown at export time" — so it
 * is scoped to `'live'`-sourced dimensions only: a manual dimension has no
 * live-freshness expectation to fail, and contributes nothing to this
 * flag either way. Reuses `utils/protocolStatus.ts`'s own
 * `isTimestampStale` (refactored out of that module's private
 * `isV4DataStale` this same stage) — the identical threshold and
 * "no known fetch time is never fresh" rule the live status badge itself
 * uses, so an export can never claim "fresh" for data the badge would
 * call stale, or vice versa. Worse-of-two across both live dimensions,
 * the same composition `deriveProtocolStatus` already uses for its own
 * `'stale'`/`'live'` badge. `null` for a V3 portfolio (freshness is a
 * V4-live-sync concept; V3's own freshness is already covered by
 * `market`/`protocolUpdatedAt`, untouched by this stage) or when neither
 * V4 dimension is currently `'live'`-sourced (nothing live to assess —
 * distinct from "assessed and found stale").
 */
export interface ExportProvenance {
  protocolVersion: 'v3' | 'v4';
  v4DebtStateSource: 'manual' | 'live' | null;
  v4CollateralRiskSource: 'manual' | 'live' | null;
  v4DebtStateUpdatedAt: string | null;
  v4CollateralRiskUpdatedAt: string | null;
  v4DataStaleAtExport: boolean | null;
}

export function resolveExportProvenance(
  portfolio: ApplicationPortfolio,
  now: string = new Date().toISOString(),
): ExportProvenance {
  const protocolVersion = portfolio.protocolVersion === 'v4' ? 'v4' : 'v3';

  if (protocolVersion === 'v3') {
    return {
      protocolVersion,
      v4DebtStateSource: null,
      v4CollateralRiskSource: null,
      v4DebtStateUpdatedAt: null,
      v4CollateralRiskUpdatedAt: null,
      v4DataStaleAtExport: null,
    };
  }

  const v4DebtStateUpdatedAt = portfolio.v4DebtStateUpdatedAt ?? null;
  const v4CollateralRiskUpdatedAt = portfolio.v4CollateralRiskUpdatedAt ?? null;
  const v4DebtStateSource = portfolio.v4DebtStateSource ?? null;
  const v4CollateralRiskSource = portfolio.v4CollateralRiskSource ?? null;

  // Only `'live'`-sourced dimensions carry a freshness expectation to
  // check — a manual dimension's timestamp (when present) records when it
  // was typed, not a live fetch, so it is excluded from this flag rather
  // than being (mis)treated as "live and possibly stale".
  const liveTimestamps: Array<string | null> = [];
  if (v4DebtStateSource === 'live') liveTimestamps.push(v4DebtStateUpdatedAt);
  if (v4CollateralRiskSource === 'live') liveTimestamps.push(v4CollateralRiskUpdatedAt);

  return {
    protocolVersion,
    v4DebtStateSource,
    v4CollateralRiskSource,
    v4DebtStateUpdatedAt,
    v4CollateralRiskUpdatedAt,
    v4DataStaleAtExport:
      liveTimestamps.length === 0
        ? null
        : liveTimestamps.some((updatedAt) => isTimestampStale(updatedAt, now)),
  };
}

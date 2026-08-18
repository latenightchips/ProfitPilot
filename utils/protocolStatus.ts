import { FRESHNESS_THRESHOLD_MINUTES, type MarketQuote } from '@/services/market/quote';
import type { AaveV4CollateralRiskLiveDataStatus } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import type { AaveV4LiveDataStatus } from '@/stores/aaveV4LiveDataStore';

import { type AaveDataStatus, deriveAaveDataStatus, formatAaveDataStatus } from './aaveDataStatus';

/**
 * Per-portfolio protocol status — V4 Readiness Audit §12 Stage 13. The
 * one version-aware UI boundary this stage's own instructions ask for
 * ("Prefer one version-aware UI/view-model boundary... if you see
 * repeated `if (protocolVersion === 'v4')` through many components, stop
 * and consider a small view-model/helper abstraction"): every place that
 * needs to know "what protocol status badge should this portfolio show"
 * (`app/portfolio/PortfolioPageClient.tsx`'s Debt section,
 * `app/DashboardPageClient.tsx`'s summary header) calls `deriveProtocolStatus`
 * once and renders `formatProtocolStatus` — no component re-derives the
 * V3-vs-V4 branching itself.
 *
 * **V3 delegates to the existing `deriveAaveDataStatus`/`formatAaveDataStatus`
 * (Portfolio Live-State Cleanup batch) rather than duplicating its
 * Live/Stale/Unavailable rule** — this module adds V4 status on top,
 * it does not reinterpret V3's own, already-correct freshness logic.
 *
 * **V4's five distinct states, in the order Stage 13's own instructions
 * name them** ("waiting for address/config, loading, live/synced,
 * provider error, missing debt state"):
 *   - `'waiting-for-address'` — `protocolVersion: 'v4'` but no `v4Position`
 *     set yet. `useAaveV4LiveSync` makes zero fetch calls in this state
 *     (its own header comment), so `aaveV4Status` is meaningless here —
 *     checked first, before reading it at all.
 *   - `'loading'` — an address is set and a fetch is in flight or about
 *     to start (`aaveV4Status` is `'idle'` or `'loading'`; `'idle'`
 *     covers the one render before the sync effect's first fetch call
 *     lands, which reads identically to "loading" from a user's
 *     perspective).
 *   - `'provider-error'` — the last fetch attempt failed
 *     (`useAaveV4LiveDataStore`'s own "on API failure, do not erase
 *     existing data" — the portfolio's last-known-good `v4DebtState`, if
 *     any, is untouched; this is a status LABEL only, never a reason to
 *     blank or fail-close any actual calculation).
 *   - `'missing-debt-state'` — the fetch succeeded at least once
 *     historically is not required; this specifically means the
 *     portfolio's own `v4DebtState` is still `undefined` even though the
 *     live-data store itself is `'ready'` (e.g. a genuinely fresh
 *     portfolio whose first sync hasn't landed as a Store write yet, or
 *     an identity mismatch `useAaveV4LiveSync`'s own guard is holding
 *     back). This is exactly the condition
 *     `checkAaveV4DebtStateAvailable` (`services/portfolio/mapping.ts`)
 *     fails closed on for every debt-sensitive calculation — the status
 *     badge and the calculation guard now describe the same real
 *     condition, not two independently-invented ones.
 *   - `'live'` — an address is set, the live-data store is `'ready'`,
 *     the portfolio has a real `v4DebtState`, and the last successful
 *     fetch is within `FRESHNESS_THRESHOLD_MINUTES`.
 *   - `'stale'` — everything `'live'` requires, except the last
 *     successful fetch (`aaveV4LastFetchedAt`) is older than
 *     `FRESHNESS_THRESHOLD_MINUTES`, or was never recorded at all
 *     (defensive: a `'ready'` status with no known fetch time cannot be
 *     verified fresh, so it is never labeled `'live'`) — V4 Readiness
 *     Audit §12 Stage 17. Reuses the same threshold V3's own
 *     `normalizeMarketQuote` freshness rule already applies
 *     (`services/market/quote.ts`'s `FRESHNESS_THRESHOLD_MINUTES`), just
 *     against this store's own fetch time rather than a price
 *     candidate's origin timestamp — see `stores/aaveV4LiveDataStore.ts`'s
 *     own header comment for why V4 has no equivalent candidate/origin
 *     concept to reuse the exact same code path. `'error'` already reads
 *     "showing last known value" and is unaffected by this check — an
 *     explicit provider error is a stronger, more specific signal than a
 *     generic staleness label.
 *
 * **`'missing-collateral-risk'` — V4 Readiness Audit §12 Stage 23F.**
 * Debt-state sync (Stage 7) and collateral-risk sync (Stage 23F) are two
 * independent live-data stores (`useAaveV4LiveDataStore`,
 * `useAaveV4CollateralRiskLiveDataStore`) that can be in different states
 * at the same instant — e.g. debt state fetched and applied moments ago
 * while the collateral-risk fetch is still in flight, or failed. This
 * module composes the two into ONE badge by taking the worse of the two
 * sub-statuses at every step, so the overall status is never more
 * optimistic than either individual one: an error on either store is an
 * overall `'provider-error'`; loading on either (with no error on the
 * other) is an overall `'loading'`; a missing `v4DebtState` is checked
 * before a missing `v4CollateralRisk` (arbitrary but stable ordering —
 * both are "not usable yet" and only one can be shown at a time);
 * staleness is measured against whichever of the two fetch times is
 * older, so a fresh debt-state fetch sitting next to a stale
 * collateral-risk fetch still reads as `'stale'` overall. This directly
 * satisfies this stage's own requirement: do not silently mark the
 * portfolio "V4 Live" if debt state is fresh but collateral-risk state is
 * missing/stale and a risk calculation depends on it.
 */
export type ProtocolStatusKind =
  | { version: 'v3'; status: AaveDataStatus }
  | {
      version: 'v4';
      status:
        | 'waiting-for-address'
        | 'loading'
        | 'live'
        | 'stale'
        | 'provider-error'
        | 'missing-debt-state'
        | 'missing-collateral-risk';
    };

export interface ProtocolStatusInput {
  /** `undefined` reads as V3 — `services/portfolio/models.ts`'s own backward-compatibility rule, applied here, not re-decided. */
  protocolVersion: 'v3' | 'v4' | undefined;
  v4PositionSet: boolean;
  v4DebtStateSet: boolean;
  aaveMarketQuote: MarketQuote | null;
  aaveV4Status: AaveV4LiveDataStatus;
  /** ISO 8601 instant of the V4 debt-state live-data store's last successful fetch, `null` if none has ever landed. */
  aaveV4LastFetchedAt: string | null;
  /** Whether the portfolio's own `v4CollateralRisk` (Stage 23C/23F) is currently set. */
  v4CollateralRiskSet: boolean;
  /** `useAaveV4CollateralRiskLiveDataStore`'s own status — independent of `aaveV4Status`, see this module's header comment. */
  aaveV4CollateralRiskStatus: AaveV4CollateralRiskLiveDataStatus;
  /** ISO 8601 instant of the V4 collateral-risk live-data store's last successful fetch, `null` if none has ever landed. */
  aaveV4CollateralRiskLastFetchedAt: string | null;
  /** ISO 8601 instant to classify V4 freshness against — caller-supplied for determinism, mirroring `normalizeMarketQuote`'s own `now`. */
  now: string;
}

function isV4DataStale(lastFetchedAt: string | null, now: string): boolean {
  if (lastFetchedAt === null) return true;
  const ageMinutes = (Date.parse(now) - Date.parse(lastFetchedAt)) / 60000;
  return ageMinutes > FRESHNESS_THRESHOLD_MINUTES;
}

export function deriveProtocolStatus(input: ProtocolStatusInput): ProtocolStatusKind {
  if (input.protocolVersion !== 'v4') {
    return { version: 'v3', status: deriveAaveDataStatus(input.aaveMarketQuote) };
  }

  if (!input.v4PositionSet) {
    return { version: 'v4', status: 'waiting-for-address' };
  }
  if (input.aaveV4Status === 'error' || input.aaveV4CollateralRiskStatus === 'error') {
    return { version: 'v4', status: 'provider-error' };
  }
  if (
    input.aaveV4Status === 'idle' ||
    input.aaveV4Status === 'loading' ||
    input.aaveV4CollateralRiskStatus === 'idle' ||
    input.aaveV4CollateralRiskStatus === 'loading'
  ) {
    return { version: 'v4', status: 'loading' };
  }
  if (!input.v4DebtStateSet) {
    return { version: 'v4', status: 'missing-debt-state' };
  }
  if (!input.v4CollateralRiskSet) {
    return { version: 'v4', status: 'missing-collateral-risk' };
  }
  if (
    isV4DataStale(input.aaveV4LastFetchedAt, input.now) ||
    isV4DataStale(input.aaveV4CollateralRiskLastFetchedAt, input.now)
  ) {
    return { version: 'v4', status: 'stale' };
  }
  return { version: 'v4', status: 'live' };
}

export function formatProtocolStatus(kind: ProtocolStatusKind): string {
  if (kind.version === 'v3') return formatAaveDataStatus(kind.status);

  switch (kind.status) {
    case 'waiting-for-address':
      return 'Aave V4 · Waiting for address';
    case 'loading':
      return 'Aave V4 · Loading';
    case 'live':
      return 'Aave V4 · Live';
    case 'stale':
      return 'Aave V4 · Stale';
    case 'provider-error':
      return 'Aave V4 · Provider error (showing last known value)';
    case 'missing-debt-state':
      return 'Aave V4 · Missing debt state';
    case 'missing-collateral-risk':
      return 'Aave V4 · Missing collateral-risk data';
  }
}

import { FRESHNESS_THRESHOLD_MINUTES, type MarketQuote } from '@/services/market/quote';
import type { AaveV4DataSource } from '@/services/portfolio/models';
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
 * **V4's states**, in the precedence order `deriveProtocolStatus` checks
 * them:
 *   - `'manual'` — V4 Readiness Audit §12 Stage 25. Checked FIRST, before
 *     anything live-fetch-related: both dimensions already have a real,
 *     usable value, and at least one of them is `'manual'`-sourced. See
 *     "Manual/hypothetical mode" below for why this must win over a
 *     concurrent loading/error state for the OTHER, still-live-syncing
 *     dimension, rather than the reverse.
 *   - `'waiting-for-address'` — genuinely nothing provided yet for
 *     EITHER V4 dimension: no `v4Position`, no `v4DebtState`, no
 *     `v4CollateralRisk`. Narrower than it once was (V4 Readiness Audit
 *     §12 Stage 25) — a portfolio that already has manual data for at
 *     least one dimension never reaches this branch (the `'manual'`
 *     check above only fires when BOTH dimensions are usable, so a
 *     partially-manual portfolio instead falls through to the
 *     `'missing-*'` checks below, which is the more specific, more
 *     actionable answer).
 *   - `'loading'` / `'provider-error'` — only reachable when
 *     `v4PositionSet` is true (an address exists — with none, nothing is
 *     genuinely "in flight," so an idle live-data store must never read
 *     as "loading"). Checked before `'missing-debt-state'`/
 *     `'missing-collateral-risk'` below, preserving Stage 13's own
 *     original precedence: the ordinary "a fetch just started, hasn't
 *     landed yet" case must still read as `'loading'`, not
 *     `'missing-debt-state'`.
 *   - `'missing-debt-state'` / `'missing-collateral-risk'` — that
 *     specific dimension has neither a live nor a manual value, and (per
 *     the two checks above) this isn't merely "still loading." This is
 *     exactly the condition `checkAaveV4DebtStateAvailable`/
 *     `checkAaveV4CollateralRiskAvailable` (`services/portfolio/mapping.ts`)
 *     fail closed on for every V4 calculation — the status badge and the
 *     calculation guard describe the same real condition, never two
 *     independently-invented ones.
 *   - `'stale'` / `'live'` — reached only once BOTH dimensions are
 *     confirmed set and `'live'`-sourced (the `'manual'` check above
 *     already ruled out either being manual); unchanged from Stage
 *     17/23F's own composition logic (worse-of-two across the two
 *     independent live-data stores). See each case's own reasoning below,
 *     carried over unchanged.
 *
 * **Manual/hypothetical mode (V4 Readiness Audit §12 Stage 25).** A user
 * must be able to model a V4 portfolio with zero wallet address and zero
 * RPC calls — `hooks/useAaveV4CollateralRiskLiveSync.ts`'s and
 * `useAaveV4LiveSync.ts`'s own live-sync machinery stays completely
 * optional enrichment, never a prerequisite. `v4DebtStateSource`/
 * `v4CollateralRiskSource` (`services/portfolio/models.ts`'s
 * `AaveV4DataSource`) record, independently per dimension, whether the
 * portfolio's current value came from a real on-chain read (`'live'`) or
 * was typed directly by the user (`'manual'`). Whenever a dimension is
 * manual, this module reports the honest, calculation-ready `'manual'`
 * status rather than either of two wrong alternatives: claiming `'live'`
 * (a freshness guarantee this module has no way to back up for a
 * user-typed number), or blocking/warning as if something were actually
 * missing (a manual value IS present and IS exactly what
 * `checkAaveV4DebtStateAvailable`/`checkAaveV4CollateralRiskAvailable`
 * already treat as sufficient — presence, not provenance, is what those
 * guards have ever checked). `'manual'` is reached regardless of whether
 * a live fetch is concurrently loading, has failed, or has never been
 * attempted at all — none of that changes whether the CURRENT value is
 * usable right now, which is what this status communicates. A live
 * fetch's own failure remains separately visible through
 * `aaveV4Status`/`aaveV4CollateralRiskStatus`'s own `errorMessage` (each
 * store's existing field) for a caller that wants to surface it
 * additionally — this module does not fold "a live attempt is also
 * failing in the background" into the primary status string, since doing
 * so would risk exactly what Stage 25's own instructions forbid:
 * "pretending manual state is live" in reverse, i.e. making a perfectly
 * usable manual value look broken because of an unrelated, non-blocking
 * live-sync hiccup.
 *
 * **`'live'` still means what it always meant**: BOTH dimensions
 * `'live'`-sourced, both live-data stores `'ready'`, both fetches within
 * `FRESHNESS_THRESHOLD_MINUTES`. A mixed state (one dimension live, the
 * other still manual) is conservatively reported as `'manual'` overall —
 * never `'live'` — since claiming `'live'` would overstate the freshness
 * of the dimension that isn't. `'stale'` is everything `'live'` requires,
 * except the last successful fetch (`aaveV4LastFetchedAt`/
 * `aaveV4CollateralRiskLastFetchedAt`) is older than
 * `FRESHNESS_THRESHOLD_MINUTES`, or was never recorded at all (defensive:
 * a `'ready'` status with no known fetch time cannot be verified fresh,
 * so it is never labeled `'live'`) — V4 Readiness Audit §12 Stage 17,
 * reusing the same threshold V3's own `normalizeMarketQuote` freshness
 * rule already applies (`services/market/quote.ts`'s
 * `FRESHNESS_THRESHOLD_MINUTES`), just against each store's own fetch
 * time rather than a price candidate's origin timestamp. Composed
 * worse-of-two across the two independent live-data stores (V4 Readiness
 * Audit §12 Stage 23F) — a fresh debt-state fetch sitting next to a stale
 * collateral-risk fetch still reads as `'stale'` overall.
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
        | 'missing-collateral-risk'
        | 'manual';
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
  /**
   * V4 Readiness Audit §12 Stage 25 — the portfolio's own
   * `v4DebtStateSource`. `undefined` whenever `v4DebtStateSet` is
   * `false` (nothing to have a source for yet); always defined
   * otherwise, per `ApplicationPortfolio`'s own invariant.
   */
  v4DebtStateSource: AaveV4DataSource | undefined;
  /** Same shape as `v4DebtStateSource`, independently, for `v4CollateralRiskSet`. */
  v4CollateralRiskSource: AaveV4DataSource | undefined;
  /** ISO 8601 instant to classify V4 freshness against — caller-supplied for determinism, mirroring `normalizeMarketQuote`'s own `now`. */
  now: string;
}

/**
 * Whether a given ISO 8601 timestamp is older than
 * `FRESHNESS_THRESHOLD_MINUTES` (or absent) as of `now` — V4 Readiness
 * Audit §12 P2-1. Extracted from this module's own `isV4DataStale` (Stage
 * 17) with no behavior change, so this module's live-status badge and
 * export code's own "was this data stale at export time" computation
 * (`utils/exportProvenance.ts`) share one definition of "stale" rather
 * than risking two independently-invented ones. Exported for that reuse;
 * `deriveProtocolStatus`'s own precedence chain below is otherwise
 * untouched by this stage — see this stage's final report for why the
 * live status badge itself was deliberately left unwired to the newly
 * persisted freshness timestamps.
 */
export function isTimestampStale(lastFetchedAt: string | null, now: string): boolean {
  if (lastFetchedAt === null) return true;
  const ageMinutes = (Date.parse(now) - Date.parse(lastFetchedAt)) / 60000;
  return ageMinutes > FRESHNESS_THRESHOLD_MINUTES;
}

function isV4DataStale(lastFetchedAt: string | null, now: string): boolean {
  return isTimestampStale(lastFetchedAt, now);
}

export function deriveProtocolStatus(input: ProtocolStatusInput): ProtocolStatusKind {
  if (input.protocolVersion !== 'v4') {
    return { version: 'v3', status: deriveAaveDataStatus(input.aaveMarketQuote) };
  }

  // 1. Full manual gate — V4 Readiness Audit §12 Stage 25. Checked FIRST,
  // before any live-fetch status is even read: both dimensions already
  // have a usable value, and at least one is `'manual'`. A concurrent
  // live fetch (loading, or even failing) for the other dimension must
  // never override this — "retain the valid manual state... do not
  // clear it merely because live synchronization started" is this
  // stage's own mandatory semantic. Requiring BOTH dimensions `Set` is
  // what keeps this from ever firing for a genuinely incomplete
  // portfolio (one where a dimension is entirely absent) — that falls
  // through to the missing-state checks below instead, unchanged.
  if (
    input.v4DebtStateSet &&
    input.v4CollateralRiskSet &&
    (input.v4DebtStateSource === 'manual' || input.v4CollateralRiskSource === 'manual')
  ) {
    return { version: 'v4', status: 'manual' };
  }

  // 2. Truly nothing provided at all — no address, no manual entry for
  // either dimension.
  if (!input.v4PositionSet && !input.v4DebtStateSet && !input.v4CollateralRiskSet) {
    return { version: 'v4', status: 'waiting-for-address' };
  }

  // 3. A live fetch is only ever genuinely "in flight" or "erroring"
  // once an address exists — `aaveV4Status`/`aaveV4CollateralRiskStatus`
  // sitting at their `'idle'` default with no address must never read as
  // "loading" (nothing is happening, and nothing will start on its own
  // without one). Checked before the missing-state checks below so the
  // ordinary "fetch just started, hasn't landed yet" case still reads as
  // `'loading'`, not `'missing-debt-state'` — unchanged from Stage 13's
  // own original precedence.
  if (input.v4PositionSet) {
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
  }

  // 4. By now: either there is no address (and step 2 already ruled out
  // "nothing at all"), or there is one and both live stores are past
  // idle/loading/error (i.e. `'ready'`). Either way, a still-unset
  // dimension here is a genuine, reportable gap — never "loading",
  // never silently treated as manual.
  if (!input.v4DebtStateSet) {
    return { version: 'v4', status: 'missing-debt-state' };
  }
  if (!input.v4CollateralRiskSet) {
    return { version: 'v4', status: 'missing-collateral-risk' };
  }

  // 5. Both dimensions are set and neither is manual (step 1 already
  // ruled that out) — both are confirmed `'live'`-sourced. Unchanged
  // Stage 17/23F freshness composition.
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
    case 'manual':
      return 'Aave V4 · Manual entry';
  }
}

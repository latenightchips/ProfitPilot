import { describe, expect, it } from 'vitest';

import type { MarketQuote, MarketQuoteAvailable } from '@/services/market/quote';
import type { AaveV4CollateralRiskLiveDataStatus } from '@/stores/aaveV4CollateralRiskLiveDataStore';
import type { AaveV4LiveDataStatus } from '@/stores/aaveV4LiveDataStore';
import {
  deriveProtocolStatus,
  formatProtocolStatus,
  type ProtocolStatusInput,
} from '@/utils/protocolStatus';

/**
 * `deriveProtocolStatus`/`formatProtocolStatus` — V4 Readiness Audit §12
 * Stage 13. The one version-aware status view-model boundary this stage's
 * own instructions asked for. Every case below is derived from real,
 * already-established state only — never a fabricated V4 value.
 */
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

const NOW = new Date().toISOString();

function baseInput(overrides: Partial<ProtocolStatusInput> = {}): ProtocolStatusInput {
  const merged: Omit<ProtocolStatusInput, 'v4DebtStateSource' | 'v4CollateralRiskSource'> = {
    protocolVersion: undefined,
    v4PositionSet: false,
    v4DebtStateSet: false,
    aaveMarketQuote: freshQuote(),
    aaveV4Status: 'idle',
    // V4 Readiness Audit §12 Stage 17 — defaults to "just fetched", so
    // every pre-existing case below (written before staleness existed)
    // still reads as fresh/live unless a test overrides it.
    aaveV4LastFetchedAt: NOW,
    // V4 Readiness Audit §12 Stage 23F — defaults to "already synced and
    // fresh", so every pre-existing debt-state-focused case above
    // continues to exercise ONLY the debt-state branch it was written
    // for, unaffected by the new collateral-risk composition; a
    // dedicated describe block below overrides these to exercise
    // collateral-risk-driven statuses on their own.
    v4CollateralRiskSet: true,
    aaveV4CollateralRiskStatus: 'ready',
    aaveV4CollateralRiskLastFetchedAt: NOW,
    now: NOW,
    ...overrides,
  };
  return {
    ...merged,
    // V4 Readiness Audit §12 Stage 25 — defaults each source to `'live'`
    // whenever the corresponding value is set, UNLESS a test explicitly
    // overrides it. Every pre-existing case above (written before manual
    // mode existed) was already modeling live-synced data, so this
    // preserves every one of them exercising exactly the live-composition
    // branches they were written for, with zero changes to their own
    // override objects — a dedicated describe block below exercises the
    // new `'manual'` branch on its own by overriding these explicitly.
    v4DebtStateSource: overrides.v4DebtStateSource ?? (merged.v4DebtStateSet ? 'live' : undefined),
    v4CollateralRiskSource:
      overrides.v4CollateralRiskSource ?? (merged.v4CollateralRiskSet ? 'live' : undefined),
  };
}

describe('deriveProtocolStatus — V3/unset (delegates to the existing V3 freshness rule)', () => {
  it('reports live V3 status when protocolVersion is unset and the market quote is fresh', () => {
    expect(deriveProtocolStatus(baseInput())).toEqual({ version: 'v3', status: 'live' });
  });

  it('reports live V3 status when protocolVersion is explicitly "v3"', () => {
    expect(deriveProtocolStatus(baseInput({ protocolVersion: 'v3' }))).toEqual({
      version: 'v3',
      status: 'live',
    });
  });

  it('reports stale V3 status for a stale market quote', () => {
    const stale: MarketQuote = { ...freshQuote(), freshness: 'stale' };
    expect(deriveProtocolStatus(baseInput({ aaveMarketQuote: stale }))).toEqual({
      version: 'v3',
      status: 'stale',
    });
  });

  it('reports unavailable V3 status when no quote has ever been fetched', () => {
    expect(deriveProtocolStatus(baseInput({ aaveMarketQuote: null }))).toEqual({
      version: 'v3',
      status: 'unavailable',
    });
  });

  it('never reads v4Position/v4DebtState/aaveV4Status for a V3 portfolio (no cross-inference)', () => {
    const result = deriveProtocolStatus(
      baseInput({ v4PositionSet: true, v4DebtStateSet: true, aaveV4Status: 'error' }),
    );
    expect(result).toEqual({ version: 'v3', status: 'live' });
  });
});

describe('deriveProtocolStatus — V4, all five distinct states', () => {
  it('reports "waiting-for-address" when protocolVersion is "v4" but nothing has been provided yet (no address, no manual data)', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: false,
          v4DebtStateSet: false,
          v4CollateralRiskSet: false,
        }),
      ),
    ).toEqual({ version: 'v4', status: 'waiting-for-address' });
  });

  it('reports "waiting-for-address" regardless of aaveV4Status when nothing has been provided yet', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: false,
          v4DebtStateSet: false,
          v4CollateralRiskSet: false,
          aaveV4Status: 'ready',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'waiting-for-address' });
  });

  it.each<AaveV4LiveDataStatus>(['idle', 'loading'])(
    'reports "loading" when v4Position is set and aaveV4Status is %s',
    (aaveV4Status) => {
      expect(
        deriveProtocolStatus(
          baseInput({ protocolVersion: 'v4', v4PositionSet: true, aaveV4Status }),
        ),
      ).toEqual({ version: 'v4', status: 'loading' });
    },
  );

  it('reports "provider-error" when the last fetch failed', () => {
    expect(
      deriveProtocolStatus(
        baseInput({ protocolVersion: 'v4', v4PositionSet: true, aaveV4Status: 'error' }),
      ),
    ).toEqual({ version: 'v4', status: 'provider-error' });
  });

  it('reports "missing-debt-state" when the fetch is ready but v4DebtState is still unset', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: false,
          aaveV4Status: 'ready',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-debt-state' });
  });

  it('reports "live" only when address is set, the fetch is ready, AND v4DebtState is set', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'live' });
  });

  it('provider-error takes priority over missing-debt-state (a failed refresh, not simply never-synced)', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: false,
          aaveV4Status: 'error',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'provider-error' });
  });
});

/**
 * V4 freshness/staleness — V4 Readiness Audit §12 Stage 17. "The UI must
 * not continue claiming Aave V4 · Live indefinitely for an old snapshot."
 * Reuses `services/market/quote.ts`'s own `FRESHNESS_THRESHOLD_MINUTES`
 * (5 minutes), applied to the V4 live-data store's own `lastFetchedAt`
 * instead of a price candidate's origin timestamp — see
 * `stores/aaveV4LiveDataStore.ts`'s own header comment for why V4 has no
 * equivalent candidate/origin concept to reuse the exact same code path.
 */
describe('deriveProtocolStatus — V4 freshness/staleness (Stage 17)', () => {
  function minutesAgo(minutes: number): string {
    return new Date(Date.parse(NOW) - minutes * 60_000).toISOString();
  }

  it('reports "live" when the last fetch is well within the 5-minute freshness window', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          aaveV4LastFetchedAt: minutesAgo(1),
        }),
      ),
    ).toEqual({ version: 'v4', status: 'live' });
  });

  it('reports "stale" once the last fetch is older than the 5-minute freshness window', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          aaveV4LastFetchedAt: minutesAgo(10),
        }),
      ),
    ).toEqual({ version: 'v4', status: 'stale' });
  });

  it('reports "stale" (never "live") when ready/synced but no fetch time was ever recorded — cannot verify freshness', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          aaveV4LastFetchedAt: null,
        }),
      ),
    ).toEqual({ version: 'v4', status: 'stale' });
  });

  it('provider-error still takes priority over staleness (a failed refresh, not a merely-old one)', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'error',
          aaveV4LastFetchedAt: minutesAgo(60),
        }),
      ),
    ).toEqual({ version: 'v4', status: 'provider-error' });
  });

  it('missing-debt-state still takes priority over staleness', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: false,
          aaveV4Status: 'ready',
          aaveV4LastFetchedAt: minutesAgo(60),
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-debt-state' });
  });

  it('a V3 (or unset) portfolio never reads aaveV4LastFetchedAt (no cross-inference)', () => {
    expect(deriveProtocolStatus(baseInput({ aaveV4LastFetchedAt: null }))).toEqual({
      version: 'v3',
      status: 'live',
    });
  });
});

/**
 * V4 collateral-risk composition — V4 Readiness Audit §12 Stage 23F.
 * `deriveProtocolStatus` now composes TWO independent live-data stores
 * (debt-state, collateral-risk) into one badge, taking the worse of the
 * two at every step, per this stage's own explicit requirement: "Do not
 * silently mark the portfolio 'V4 Live' if debt state is fresh but
 * collateral-risk state is missing/stale."
 */
describe('deriveProtocolStatus — V4 collateral-risk composition (Stage 23F)', () => {
  it('reports "missing-collateral-risk" when debt state is set but collateral risk is not', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          v4CollateralRiskSet: false,
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-collateral-risk' });
  });

  it('reports "live" only when BOTH debt state and collateral risk are set, ready, and fresh', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          v4CollateralRiskSet: true,
          aaveV4CollateralRiskStatus: 'ready',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'live' });
  });

  it.each<AaveV4CollateralRiskLiveDataStatus>(['idle', 'loading'])(
    'reports "loading" when debt state is ready but collateral-risk fetch is %s, even though v4DebtState is set',
    (aaveV4CollateralRiskStatus) => {
      expect(
        deriveProtocolStatus(
          baseInput({
            protocolVersion: 'v4',
            v4PositionSet: true,
            v4DebtStateSet: true,
            aaveV4Status: 'ready',
            aaveV4CollateralRiskStatus,
          }),
        ),
      ).toEqual({ version: 'v4', status: 'loading' });
    },
  );

  it('reports "provider-error" when the collateral-risk fetch failed, even though debt state is ready', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          aaveV4CollateralRiskStatus: 'error',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'provider-error' });
  });

  it('reports "stale" when debt state is fresh but collateral-risk data is stale (worse-of-two)', () => {
    const staleTime = new Date(Date.parse(NOW) - 60 * 60_000).toISOString();
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          aaveV4Status: 'ready',
          aaveV4LastFetchedAt: NOW,
          aaveV4CollateralRiskStatus: 'ready',
          aaveV4CollateralRiskLastFetchedAt: staleTime,
        }),
      ),
    ).toEqual({ version: 'v4', status: 'stale' });
  });

  it('missing-debt-state still takes priority over missing-collateral-risk (stable ordering)', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: false,
          aaveV4Status: 'ready',
          v4CollateralRiskSet: false,
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-debt-state' });
  });

  it('a V3 (or unset) portfolio never reads collateral-risk fields (no cross-inference)', () => {
    const result = deriveProtocolStatus(
      baseInput({
        v4CollateralRiskSet: false,
        aaveV4CollateralRiskStatus: 'error',
        aaveV4CollateralRiskLastFetchedAt: null,
      }),
    );
    expect(result).toEqual({ version: 'v3', status: 'live' });
  });
});

/**
 * Manual/hypothetical V4 mode — V4 Readiness Audit §12 Stage 25. A user
 * with no wallet address and zero RPC calls must be able to fully model
 * a V4 portfolio; `deriveProtocolStatus` must report this honestly
 * (`'manual'`) rather than `'waiting-for-address'` or any of the
 * live-only sub-states, and must never let a concurrent live-sync
 * attempt (loading or failing) override a valid manual reading.
 */
describe('deriveProtocolStatus — manual/hypothetical V4 mode (Stage 25)', () => {
  it('reports "manual" for a fully manual portfolio with no wallet address at all', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: false,
          v4DebtStateSet: true,
          v4DebtStateSource: 'manual',
          v4CollateralRiskSet: true,
          v4CollateralRiskSource: 'manual',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'manual' });
  });

  it('never reports "waiting-for-address" for a portfolio with valid manual data, even with no address', () => {
    const result = deriveProtocolStatus(
      baseInput({
        protocolVersion: 'v4',
        v4PositionSet: false,
        v4DebtStateSet: true,
        v4DebtStateSource: 'manual',
        v4CollateralRiskSet: true,
        v4CollateralRiskSource: 'manual',
      }),
    );
    expect(result.status).not.toBe('waiting-for-address');
  });

  it('reports "manual" when only ONE dimension is manual and the other is genuinely live', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          v4DebtStateSource: 'live',
          aaveV4Status: 'ready',
          v4CollateralRiskSet: true,
          v4CollateralRiskSource: 'manual',
          aaveV4CollateralRiskStatus: 'ready',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'manual' });
  });

  it('a mixed manual+live state is never reported as "live" (conservative — never overstates freshness)', () => {
    const result = deriveProtocolStatus(
      baseInput({
        protocolVersion: 'v4',
        v4PositionSet: true,
        v4DebtStateSet: true,
        v4DebtStateSource: 'live',
        aaveV4Status: 'ready',
        v4CollateralRiskSet: true,
        v4CollateralRiskSource: 'manual',
        aaveV4CollateralRiskStatus: 'ready',
      }),
    );
    expect(result.status).not.toBe('live');
  });

  it('"manual" wins over a concurrently-loading live fetch (address just added, sync pending) — retains usable manual state', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          v4DebtStateSource: 'manual',
          v4CollateralRiskSet: true,
          v4CollateralRiskSource: 'manual',
          aaveV4Status: 'loading',
          aaveV4CollateralRiskStatus: 'loading',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'manual' });
  });

  it('"manual" wins over a concurrently-FAILED live fetch — never destroys or hides valid manual state behind a provider-error label', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: true,
          v4DebtStateSource: 'manual',
          v4CollateralRiskSet: true,
          v4CollateralRiskSource: 'manual',
          aaveV4Status: 'error',
          aaveV4CollateralRiskStatus: 'error',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'manual' });
  });

  it('missing-collateral-risk still takes priority over "manual" when collateral risk is genuinely absent, even though debt is manually set', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: false,
          v4DebtStateSet: true,
          v4DebtStateSource: 'manual',
          v4CollateralRiskSet: false,
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-collateral-risk' });
  });

  it('a plain address-entered, never-synced-or-entered portfolio still reports "loading"/"missing", not "manual" (no source implies no manual data)', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: false,
          v4CollateralRiskSet: false,
          aaveV4Status: 'ready',
          aaveV4CollateralRiskStatus: 'ready',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-debt-state' });
  });

  it('an idle live-data store with no address never reads as "loading" — reports the specific missing dimension instead', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: false,
          v4DebtStateSet: true,
          v4DebtStateSource: 'manual',
          v4CollateralRiskSet: false,
          aaveV4CollateralRiskStatus: 'idle',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'missing-collateral-risk' });
  });

  it('the ordinary "fetch just started, address set, nothing manual" case still reports "loading", not "missing-debt-state" (Stage 13 precedence preserved)', () => {
    expect(
      deriveProtocolStatus(
        baseInput({
          protocolVersion: 'v4',
          v4PositionSet: true,
          v4DebtStateSet: false,
          v4CollateralRiskSet: false,
          aaveV4Status: 'loading',
          aaveV4CollateralRiskStatus: 'idle',
        }),
      ),
    ).toEqual({ version: 'v4', status: 'loading' });
  });
});

describe('formatProtocolStatus — labels', () => {
  it('delegates V3 labels to the existing formatAaveDataStatus wording exactly', () => {
    expect(formatProtocolStatus({ version: 'v3', status: 'live' })).toBe('Aave V3 · Live');
    expect(formatProtocolStatus({ version: 'v3', status: 'stale' })).toBe('Aave V3 · Stale');
    expect(formatProtocolStatus({ version: 'v3', status: 'unavailable' })).toContain(
      'last known value',
    );
  });

  it('produces eight distinct, clearly labeled V4 states (Stage 25 adds "manual")', () => {
    const labels = new Set(
      (
        [
          'waiting-for-address',
          'loading',
          'live',
          'stale',
          'provider-error',
          'missing-debt-state',
          'missing-collateral-risk',
          'manual',
        ] as const
      ).map((status) => formatProtocolStatus({ version: 'v4', status })),
    );
    expect(labels.size).toBe(8);
    for (const label of labels) {
      expect(label.startsWith('Aave V4 ·')).toBe(true);
    }
  });

  it('labels "manual" plainly, never implying anything is missing or blocked', () => {
    expect(formatProtocolStatus({ version: 'v4', status: 'manual' })).toBe(
      'Aave V4 · Manual entry',
    );
  });

  it('the provider-error label notes the value shown is last-known, matching the V3 unavailable convention', () => {
    expect(formatProtocolStatus({ version: 'v4', status: 'provider-error' })).toContain(
      'last known value',
    );
  });

  it('labels "stale" plainly, matching the V3 "Stale" convention exactly (no parenthetical)', () => {
    expect(formatProtocolStatus({ version: 'v4', status: 'stale' })).toBe('Aave V4 · Stale');
  });
});

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
  return {
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
  it('reports "waiting-for-address" when protocolVersion is "v4" but v4Position is unset', () => {
    expect(
      deriveProtocolStatus(baseInput({ protocolVersion: 'v4', v4PositionSet: false })),
    ).toEqual({ version: 'v4', status: 'waiting-for-address' });
  });

  it('reports "waiting-for-address" regardless of aaveV4Status when v4Position is unset', () => {
    expect(
      deriveProtocolStatus(
        baseInput({ protocolVersion: 'v4', v4PositionSet: false, aaveV4Status: 'ready' }),
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

describe('formatProtocolStatus — labels', () => {
  it('delegates V3 labels to the existing formatAaveDataStatus wording exactly', () => {
    expect(formatProtocolStatus({ version: 'v3', status: 'live' })).toBe('Aave V3 · Live');
    expect(formatProtocolStatus({ version: 'v3', status: 'stale' })).toBe('Aave V3 · Stale');
    expect(formatProtocolStatus({ version: 'v3', status: 'unavailable' })).toContain(
      'last known value',
    );
  });

  it('produces seven distinct, clearly labeled V4 states (Stage 23F adds "missing-collateral-risk")', () => {
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
        ] as const
      ).map((status) => formatProtocolStatus({ version: 'v4', status })),
    );
    expect(labels.size).toBe(7);
    for (const label of labels) {
      expect(label.startsWith('Aave V4 ·')).toBe(true);
    }
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

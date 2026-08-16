import { describe, expect, it } from 'vitest';

import type { MarketQuote, MarketQuoteAvailable } from '@/services/market/quote';
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

function baseInput(overrides: Partial<ProtocolStatusInput> = {}): ProtocolStatusInput {
  return {
    protocolVersion: undefined,
    v4PositionSet: false,
    v4DebtStateSet: false,
    aaveMarketQuote: freshQuote(),
    aaveV4Status: 'idle',
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

describe('formatProtocolStatus — labels', () => {
  it('delegates V3 labels to the existing formatAaveDataStatus wording exactly', () => {
    expect(formatProtocolStatus({ version: 'v3', status: 'live' })).toBe('Aave V3 · Live');
    expect(formatProtocolStatus({ version: 'v3', status: 'stale' })).toBe('Aave V3 · Stale');
    expect(formatProtocolStatus({ version: 'v3', status: 'unavailable' })).toContain(
      'last known value',
    );
  });

  it('produces five distinct, clearly labeled V4 states', () => {
    const labels = new Set(
      (
        ['waiting-for-address', 'loading', 'live', 'provider-error', 'missing-debt-state'] as const
      ).map((status) => formatProtocolStatus({ version: 'v4', status })),
    );
    expect(labels.size).toBe(5);
    for (const label of labels) {
      expect(label.startsWith('Aave V4 ·')).toBe(true);
    }
  });

  it('the provider-error label notes the value shown is last-known, matching the V3 unavailable convention', () => {
    expect(formatProtocolStatus({ version: 'v4', status: 'provider-error' })).toContain(
      'last known value',
    );
  });
});

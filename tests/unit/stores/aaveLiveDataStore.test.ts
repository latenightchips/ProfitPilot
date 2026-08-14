import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveLiveDataStore } from '@/stores/aaveLiveDataStore';

/**
 * Aave Live Data Store — Phase 1 read-only live-data integration.
 * `fetch` is mocked directly (no real network dependency); the Store
 * always calls the same-origin `/api/aave/reserve` route, never the
 * Aave subgraph itself.
 */
const originalFetch = global.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const INITIAL_STATE = {
  status: 'idle' as const,
  marketQuote: null,
  protocolQuote: null,
  collateralSymbol: null,
  borrowSymbol: null,
  errorMessage: null,
};

function successBody() {
  return {
    ok: true,
    data: {
      priceCandidate: { origin: 'provider', price: 60000, timestamp: new Date().toISOString() },
      protocolCandidate: {
        origin: 'live',
        timestamp: new Date().toISOString(),
        parameters: {
          maxLoanToValue: 0.73,
          liquidationThreshold: 0.78,
          borrowApr: 0.05,
          supplyApr: 0.005,
        },
      },
      collateralSymbol: 'WBTC',
      borrowSymbol: 'USDC',
    },
  };
}

beforeEach(() => {
  useAaveLiveDataStore.setState(INITIAL_STATE);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useAaveLiveDataStore — success', () => {
  it('fetches, normalizes, and stores a ready quote', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData();

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.marketQuote).toMatchObject({
      freshness: 'fresh',
      price: 60000,
      origin: 'provider',
    });
    expect(state.protocolQuote).toMatchObject({
      available: true,
      parameters: { maxLoanToValue: 0.73, liquidationThreshold: 0.78 },
    });
    expect(state.collateralSymbol).toBe('WBTC');
    expect(state.borrowSymbol).toBe('USDC');
    expect(state.errorMessage).toBeNull();
  });

  it('sets status to loading while the fetch is in flight', () => {
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    ) as unknown as typeof fetch;

    const promise = useAaveLiveDataStore.getState().fetchLiveAaveData();
    expect(useAaveLiveDataStore.getState().status).toBe('loading');

    resolveFetch(jsonResponse(successBody()));
    return promise;
  });
});

describe('useAaveLiveDataStore — failure / fallback (never erases prior good data)', () => {
  it('sets an error status with a message on a network failure', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData();

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('Live Aave data is temporarily unavailable.');
  });

  it("surfaces the route's own userMessage when the API responds with a structured failure", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        error: {
          code: 'AAVE_NOT_CONFIGURED',
          userMessage: 'Live Aave data is not configured.',
          retryable: false,
        },
      }),
    ) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData();

    expect(useAaveLiveDataStore.getState().errorMessage).toBe('Live Aave data is not configured.');
  });

  it('does not erase a previously successful quote when a later refresh fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveLiveDataStore.getState().fetchLiveAaveData();
    expect(useAaveLiveDataStore.getState().status).toBe('ready');
    const previousQuote = useAaveLiveDataStore.getState().marketQuote;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveLiveDataStore.getState().fetchLiveAaveData();

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('error');
    // The last successfully fetched quote is still there, underneath the error.
    expect(state.marketQuote).toEqual(previousQuote);
    expect(state.protocolQuote).not.toBeNull();
  });

  it('does not crash on a malformed (non-JSON) API response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData();

    expect(useAaveLiveDataStore.getState().status).toBe('error');
  });
});

describe('useAaveLiveDataStore — freshness classification (reuses normalizeMarketQuote unmodified)', () => {
  it('classifies a stale-but-present timestamp as stale, not unavailable', async () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const body = successBody();
    body.data.priceCandidate.timestamp = staleTimestamp;
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(body)) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData();

    expect(useAaveLiveDataStore.getState().marketQuote).toMatchObject({ freshness: 'stale' });
  });
});

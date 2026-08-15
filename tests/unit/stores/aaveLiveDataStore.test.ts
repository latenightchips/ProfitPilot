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
  source: null,
  errorMessage: null,
};

function successBody(overrides?: { borrowSymbol?: string; borrowApr?: number }) {
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
          borrowApr: overrides?.borrowApr ?? 0.05,
          supplyApr: 0.005,
        },
      },
      collateralSymbol: 'WBTC',
      borrowSymbol: overrides?.borrowSymbol ?? 'USDC',
      source: {
        protocol: 'aave',
        version: 'v3',
        network: 'Ethereum Mainnet',
        method: 'rpc',
        blockNumber: '21000000',
      },
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

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

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
    expect(state.source).toEqual({
      protocol: 'aave',
      version: 'v3',
      network: 'Ethereum Mainnet',
      method: 'rpc',
      blockNumber: '21000000',
    });
  });

  it('sets status to loading while the fetch is in flight', () => {
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    ) as unknown as typeof fetch;

    const promise = useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');
    expect(useAaveLiveDataStore.getState().status).toBe('loading');

    resolveFetch(jsonResponse(successBody()));
    return promise;
  });
});

describe('useAaveLiveDataStore — borrowAsset forwarding (USDT Support milestone)', () => {
  it('includes the requested borrow asset in the fetch URL', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody({ borrowSymbol: 'USDT' })));
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDT');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('borrowAsset=USDT'));
  });

  it('includes USDC in the fetch URL when requested explicitly', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('borrowAsset=USDC'));
  });
});

describe('useAaveLiveDataStore — asset-switch race protection (USDT Support milestone)', () => {
  it('a stale in-flight USDC response cannot overwrite a newer USDT response that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const usdcPromise = useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');
    const usdtPromise = useAaveLiveDataStore.getState().fetchLiveAaveData('USDT');
    expect(resolvers).toHaveLength(2);

    // The newer (USDT) request resolves first.
    resolvers[1](jsonResponse(successBody({ borrowSymbol: 'USDT', borrowApr: 0.06 })));
    await usdtPromise;
    expect(useAaveLiveDataStore.getState().borrowSymbol).toBe('USDT');

    // The stale (USDC) request resolves after — must be discarded entirely,
    // not applied on top of the already-landed, newer USDT state.
    resolvers[0](jsonResponse(successBody({ borrowSymbol: 'USDC', borrowApr: 0.05 })));
    await usdcPromise;

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.borrowSymbol).toBe('USDT');
    expect(state.protocolQuote).toMatchObject({ parameters: { borrowApr: 0.06 } });
  });

  it('a stale in-flight USDC failure cannot overwrite a newer USDT success that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    const rejecters: Array<(reason: unknown) => void> = [];
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve, reject) => {
          resolvers.push(resolve);
          rejecters.push(reject);
        }),
    ) as unknown as typeof fetch;

    const usdcPromise = useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');
    const usdtPromise = useAaveLiveDataStore.getState().fetchLiveAaveData('USDT');

    resolvers[1](jsonResponse(successBody({ borrowSymbol: 'USDT' })));
    await usdtPromise;
    expect(useAaveLiveDataStore.getState().status).toBe('ready');

    // The stale USDC request fails after USDT already succeeded — must not
    // flip the (already correct, newer) 'ready' state back to 'error'.
    rejecters[0](new TypeError('Failed to fetch'));
    await usdcPromise;

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.borrowSymbol).toBe('USDT');
  });
});

describe('useAaveLiveDataStore — failure / fallback (never erases prior good data)', () => {
  it('sets an error status with a message on a network failure', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

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

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

    expect(useAaveLiveDataStore.getState().errorMessage).toBe('Live Aave data is not configured.');
  });

  it("surfaces AAVE_UNSUPPORTED_BORROW_ASSET (e.g. DAI) as an error, without ever substituting another asset's data", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        error: {
          code: 'AAVE_UNSUPPORTED_BORROW_ASSET',
          userMessage: 'Live Aave V3 data is not yet available for DAI.',
          retryable: false,
        },
      }),
    ) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData('DAI');

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('Live Aave V3 data is not yet available for DAI.');
    expect(state.protocolQuote).toBeNull();
    expect(state.borrowSymbol).toBeNull();
  });

  it('does not erase a previously successful quote when a later refresh fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');
    expect(useAaveLiveDataStore.getState().status).toBe('ready');
    const previousQuote = useAaveLiveDataStore.getState().marketQuote;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

    const state = useAaveLiveDataStore.getState();
    expect(state.status).toBe('error');
    // The last successfully fetched quote is still there, underneath the error.
    expect(state.marketQuote).toEqual(previousQuote);
    expect(state.protocolQuote).not.toBeNull();
    // Technical details (protocol/version/network/block number) also survive.
    expect(state.source).not.toBeNull();
  });

  it('does not crash on a malformed (non-JSON) API response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

    expect(useAaveLiveDataStore.getState().status).toBe('error');
  });
});

describe('useAaveLiveDataStore — freshness classification (reuses normalizeMarketQuote unmodified)', () => {
  it('classifies a stale-but-present timestamp as stale, not unavailable', async () => {
    const staleTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const body = successBody();
    body.data.priceCandidate.timestamp = staleTimestamp;
    global.fetch = vi.fn().mockResolvedValue(jsonResponse(body)) as unknown as typeof fetch;

    await useAaveLiveDataStore.getState().fetchLiveAaveData('USDC');

    expect(useAaveLiveDataStore.getState().marketQuote).toMatchObject({ freshness: 'stale' });
  });
});

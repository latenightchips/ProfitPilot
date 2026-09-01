import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveV4ReservePriceStore } from '@/stores/aaveV4ReservePriceStore';

/**
 * Aave V4 Reserve-Price Live Data Store — V4 wallet-independent price
 * fix. Mirrors `tests/unit/stores/aaveV4CollateralRiskLiveDataStore.test.ts`'s
 * own conventions: `fetch` is mocked directly, the Store always calls
 * the same-origin `/api/aave/v4-reserve-price` route, never the Aave V4
 * contracts themselves. No identity parameter here at all (this store's
 * own `fetchAaveV4ReservePrice()` takes zero arguments) — the race-
 * protection tests below cover two back-to-back calls with no address/
 * asset dimension to key on, not an identity switch.
 */
const originalFetch = global.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const INITIAL_STATE = {
  status: 'idle' as const,
  canonical: null,
  errorMessage: null,
  errorCode: null,
  lastFetchedAt: null,
};

function successBody(overrides?: { collateralPriceUsd?: number }) {
  return {
    ok: true,
    data: {
      raw: {},
      canonical: { collateralPriceUsd: overrides?.collateralPriceUsd ?? 64000 },
      display: {},
    },
  };
}

beforeEach(() => {
  useAaveV4ReservePriceStore.setState(INITIAL_STATE);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useAaveV4ReservePriceStore — success', () => {
  it('fetches and stores a ready canonical value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    const state = useAaveV4ReservePriceStore.getState();
    expect(state.status).toBe('ready');
    expect(state.canonical).toEqual({ collateralPriceUsd: 64000 });
    expect(state.errorMessage).toBeNull();
  });

  it('calls the reserve-price route with no query parameters at all — no wallet address required', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    expect(fetchMock).toHaveBeenCalledWith('/api/aave/v4-reserve-price');
  });

  it('records lastFetchedAt as a real, current ISO timestamp on a successful fetch', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    const before = Date.now();
    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();
    const after = Date.now();

    const lastFetchedAt = useAaveV4ReservePriceStore.getState().lastFetchedAt;
    expect(lastFetchedAt).not.toBeNull();
    if (lastFetchedAt === null) return;
    const fetchedAtMs = Date.parse(lastFetchedAt);
    expect(fetchedAtMs).toBeGreaterThanOrEqual(before);
    expect(fetchedAtMs).toBeLessThanOrEqual(after);
  });

  it('sets status to loading while the fetch is in flight', () => {
    let resolveFetch: (value: Response) => void = () => {};
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => (resolveFetch = resolve)),
    ) as unknown as typeof fetch;

    const promise = useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();
    expect(useAaveV4ReservePriceStore.getState().status).toBe('loading');

    resolveFetch(jsonResponse(successBody()));
    return promise;
  });
});

describe('useAaveV4ReservePriceStore — race protection', () => {
  it('a stale in-flight response cannot overwrite a newer response that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();
    const secondPromise = useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();
    expect(resolvers).toHaveLength(2);

    resolvers[1](jsonResponse(successBody({ collateralPriceUsd: 65000 })));
    await secondPromise;

    resolvers[0](jsonResponse(successBody({ collateralPriceUsd: 60000 })));
    await firstPromise;

    const state = useAaveV4ReservePriceStore.getState();
    expect(state.status).toBe('ready');
    expect(state.canonical?.collateralPriceUsd).toBe(65000);
  });

  it('a stale in-flight success cannot overwrite a newer error that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();
    const secondPromise = useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    resolvers[1](
      jsonResponse({
        ok: false,
        errors: [
          {
            category: 'provider',
            code: 'AAVE_V4_RPC_NETWORK_ERROR',
            message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
          },
        ],
      }),
    );
    await secondPromise;
    expect(useAaveV4ReservePriceStore.getState().status).toBe('error');

    resolvers[0](jsonResponse(successBody()));
    await firstPromise;

    const state = useAaveV4ReservePriceStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('AAVE_V4_RPC_NETWORK_ERROR');
    expect(state.canonical).toBeNull();
  });
});

describe('useAaveV4ReservePriceStore — failure / fallback (never erases prior good data, fail closed, no fallback to V3)', () => {
  it('sets an error status with a message on a network failure', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    const state = useAaveV4ReservePriceStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('Live Aave V4 price data is temporarily unavailable.');
  });

  it("surfaces the route's own structured error message", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        errors: [
          {
            category: 'provider',
            code: 'AAVE_V4_RESERVE_NOT_FOUND',
            message: 'Live Aave V4 price data is not yet available for WBTC.',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    expect(useAaveV4ReservePriceStore.getState().errorMessage).toBe(
      'Live Aave V4 price data is not yet available for WBTC.',
    );
  });

  it('does not erase a previously successful fetch when a later refresh fails — no fallback to V3 or a fabricated value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();
    expect(useAaveV4ReservePriceStore.getState().status).toBe('ready');
    const previous = useAaveV4ReservePriceStore.getState().canonical;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    const state = useAaveV4ReservePriceStore.getState();
    expect(state.status).toBe('error');
    expect(state.canonical).toEqual(previous);
  });

  it('does not crash on a malformed (non-JSON) API response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await useAaveV4ReservePriceStore.getState().fetchAaveV4ReservePrice();

    expect(useAaveV4ReservePriceStore.getState().status).toBe('error');
  });
});

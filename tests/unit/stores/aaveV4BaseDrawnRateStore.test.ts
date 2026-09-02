import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveV4BaseDrawnRateStore } from '@/stores/aaveV4BaseDrawnRateStore';

/**
 * Aave V4 Base-Drawn-Rate Live Data Store — V4 Manual-Data / Provenance
 * Audit. Mirrors `tests/unit/stores/aaveV4ReservePriceStore.test.ts`'s
 * own conventions, one dimension over: this store's own
 * `fetchAaveV4BaseDrawnRate(debtAsset)` takes a debt asset but no
 * wallet address at all — the race-protection tests below cover two
 * back-to-back calls, not an address switch.
 */
const originalFetch = global.fetch;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const INITIAL_STATE = {
  status: 'idle' as const,
  canonical: null,
  debtAsset: null,
  errorMessage: null,
  errorCode: null,
  lastFetchedAt: null,
};

function successBody(overrides?: { baseDrawnApr?: number }) {
  return {
    ok: true,
    data: {
      raw: {},
      canonical: { baseDrawnApr: overrides?.baseDrawnApr ?? 0.04 },
      display: {},
    },
  };
}

beforeEach(() => {
  useAaveV4BaseDrawnRateStore.setState(INITIAL_STATE);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useAaveV4BaseDrawnRateStore — success', () => {
  it('fetches and stores a ready canonical value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');

    const state = useAaveV4BaseDrawnRateStore.getState();
    expect(state.status).toBe('ready');
    expect(state.canonical).toEqual({ baseDrawnApr: 0.04 });
    expect(state.debtAsset).toBe('USDC');
    expect(state.errorMessage).toBeNull();
  });

  it('calls the base-drawn-rate route with only debtAsset — no wallet address required', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');

    expect(fetchMock).toHaveBeenCalledWith('/api/aave/v4-base-drawn-rate?debtAsset=USDC');
  });

  it('records lastFetchedAt as a real, current ISO timestamp on a successful fetch', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    const before = Date.now();
    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');
    const after = Date.now();

    const lastFetchedAt = useAaveV4BaseDrawnRateStore.getState().lastFetchedAt;
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

    const promise = useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');
    expect(useAaveV4BaseDrawnRateStore.getState().status).toBe('loading');

    resolveFetch(jsonResponse(successBody()));
    return promise;
  });
});

describe('useAaveV4BaseDrawnRateStore — race protection', () => {
  it('a stale in-flight response cannot overwrite a newer response that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');
    const secondPromise = useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDT');
    expect(resolvers).toHaveLength(2);

    resolvers[1](jsonResponse(successBody({ baseDrawnApr: 0.05 })));
    await secondPromise;

    resolvers[0](jsonResponse(successBody({ baseDrawnApr: 0.03 })));
    await firstPromise;

    const state = useAaveV4BaseDrawnRateStore.getState();
    expect(state.status).toBe('ready');
    expect(state.canonical?.baseDrawnApr).toBe(0.05);
  });

  it('a stale in-flight success cannot overwrite a newer error that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');
    const secondPromise = useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDT');

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
    expect(useAaveV4BaseDrawnRateStore.getState().status).toBe('error');

    resolvers[0](jsonResponse(successBody()));
    await firstPromise;

    const state = useAaveV4BaseDrawnRateStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorCode).toBe('AAVE_V4_RPC_NETWORK_ERROR');
    expect(state.canonical).toBeNull();
  });
});

describe('useAaveV4BaseDrawnRateStore — failure / fallback (never erases prior good data, fail closed, no fallback to V3)', () => {
  it('sets an error status with a message on a network failure', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');

    const state = useAaveV4BaseDrawnRateStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe(
      'Live Aave V4 base drawn rate data is temporarily unavailable.',
    );
  });

  it("surfaces the route's own structured error message", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        errors: [
          {
            category: 'provider',
            code: 'AAVE_V4_RESERVE_NOT_FOUND',
            message: 'Live Aave V4 data is not yet available for USDC.',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');

    expect(useAaveV4BaseDrawnRateStore.getState().errorMessage).toBe(
      'Live Aave V4 data is not yet available for USDC.',
    );
  });

  it('does not erase a previously successful fetch when a later refresh fails — no fallback to V3 or a fabricated value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');
    expect(useAaveV4BaseDrawnRateStore.getState().status).toBe('ready');
    const previous = useAaveV4BaseDrawnRateStore.getState().canonical;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');

    const state = useAaveV4BaseDrawnRateStore.getState();
    expect(state.status).toBe('error');
    expect(state.canonical).toEqual(previous);
  });

  it('does not crash on a malformed (non-JSON) API response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await useAaveV4BaseDrawnRateStore.getState().fetchAaveV4BaseDrawnRate('USDC');

    expect(useAaveV4BaseDrawnRateStore.getState().status).toBe('error');
  });
});

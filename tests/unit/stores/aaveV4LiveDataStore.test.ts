import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveV4LiveDataStore } from '@/stores/aaveV4LiveDataStore';

/**
 * Aave V4 Live Data Store — V4 Readiness Audit §12 Stage 7. Mirrors
 * `tests/unit/stores/aaveLiveDataStore.test.ts`'s own conventions:
 * `fetch` is mocked directly, the Store always calls the same-origin
 * `/api/aave/v4-position` route, never the Aave V4 contracts themselves.
 */
const originalFetch = global.fetch;

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const INITIAL_STATE = {
  status: 'idle' as const,
  engineInputs: null,
  userAddress: null,
  debtAsset: null,
  errorMessage: null,
  lastFetchedAt: null,
};

function successBody(overrides?: { drawnDebt?: number }) {
  return {
    ok: true,
    data: {
      raw: {},
      engineInputs: {
        drawnDebt: overrides?.drawnDebt ?? 15000,
        premiumDebt: 500,
        baseDrawnApr: 0.05,
        riskPremium: 0.01,
      },
      display: {},
    },
  };
}

beforeEach(() => {
  useAaveV4LiveDataStore.setState(INITIAL_STATE);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useAaveV4LiveDataStore — success', () => {
  it('fetches and stores a ready engineInputs value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');

    const state = useAaveV4LiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.engineInputs).toEqual({
      drawnDebt: 15000,
      premiumDebt: 500,
      baseDrawnApr: 0.05,
      riskPremium: 0.01,
    });
    expect(state.userAddress).toBe(VALID_ADDRESS);
    expect(state.debtAsset).toBe('USDC');
    expect(state.errorMessage).toBeNull();
  });

  it('records lastFetchedAt (V4 Readiness Audit §12 Stage 17) as a real, current ISO timestamp on a successful fetch', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    const before = Date.now();
    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');
    const after = Date.now();

    const lastFetchedAt = useAaveV4LiveDataStore.getState().lastFetchedAt;
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

    const promise = useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');
    expect(useAaveV4LiveDataStore.getState().status).toBe('loading');

    resolveFetch(jsonResponse(successBody()));
    return promise;
  });

  it('includes the requested userAddress and debtAsset in the fetch URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDT');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`userAddress=${VALID_ADDRESS}`));
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('debtAsset=USDT'));
  });
});

describe('useAaveV4LiveDataStore — identity-switch race protection', () => {
  it('a stale in-flight response for one address cannot overwrite a newer response for a different address that resolves first', async () => {
    const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4LiveDataStore
      .getState()
      .fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');
    const secondPromise = useAaveV4LiveDataStore
      .getState()
      .fetchAaveV4LiveData(OTHER_ADDRESS, 'USDC');
    expect(resolvers).toHaveLength(2);

    // The newer request (OTHER_ADDRESS) resolves first.
    resolvers[1](jsonResponse(successBody({ drawnDebt: 999 })));
    await secondPromise;
    expect(useAaveV4LiveDataStore.getState().userAddress).toBe(OTHER_ADDRESS);

    // The stale request resolves after — must be discarded entirely.
    resolvers[0](jsonResponse(successBody({ drawnDebt: 1 })));
    await firstPromise;

    const state = useAaveV4LiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.userAddress).toBe(OTHER_ADDRESS);
    expect(state.engineInputs?.drawnDebt).toBe(999);
  });

  it('a stale in-flight failure cannot overwrite a newer success that resolves first', async () => {
    const resolvers: Array<(value: Response) => void> = [];
    const rejecters: Array<(reason: unknown) => void> = [];
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve, reject) => {
          resolvers.push(resolve);
          rejecters.push(reject);
        }),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4LiveDataStore
      .getState()
      .fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');
    const secondPromise = useAaveV4LiveDataStore
      .getState()
      .fetchAaveV4LiveData(VALID_ADDRESS, 'USDT');

    resolvers[1](jsonResponse(successBody()));
    await secondPromise;
    expect(useAaveV4LiveDataStore.getState().status).toBe('ready');

    rejecters[0](new TypeError('Failed to fetch'));
    await firstPromise;

    const state = useAaveV4LiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.debtAsset).toBe('USDT');
  });
});

describe('useAaveV4LiveDataStore — failure / fallback (never erases prior good data)', () => {
  it('sets an error status with a message on a network failure', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');

    const state = useAaveV4LiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('Live Aave V4 data is temporarily unavailable.');
  });

  it("surfaces the route's own structured error message (e.g. missing/invalid identity)", async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        errors: [
          {
            category: 'validation',
            code: 'AAVE_V4_INVALID_USER_ADDRESS',
            message: 'The configured Aave V4 wallet address is not valid.',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');

    expect(useAaveV4LiveDataStore.getState().errorMessage).toBe(
      'The configured Aave V4 wallet address is not valid.',
    );
  });

  it('surfaces AAVE_V4_UNSUPPORTED_DEBT_ASSET as an error, without ever substituting another asset', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      jsonResponse({
        ok: false,
        errors: [
          {
            category: 'provider',
            code: 'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
            message: 'Live Aave V4 data is not yet available for DAI.',
          },
        ],
      }),
    ) as unknown as typeof fetch;

    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'DAI');

    const state = useAaveV4LiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.engineInputs).toBeNull();
    expect(state.userAddress).toBeNull();
  });

  it('does not erase a previously successful fetch when a later refresh fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');
    expect(useAaveV4LiveDataStore.getState().status).toBe('ready');
    const previous = useAaveV4LiveDataStore.getState().engineInputs;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');

    const state = useAaveV4LiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.engineInputs).toEqual(previous);
    expect(state.userAddress).toBe(VALID_ADDRESS);
  });

  it('does not erase a previously recorded lastFetchedAt when a later refresh fails (V4 Readiness Audit §12 Stage 17)', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');
    const previousLastFetchedAt = useAaveV4LiveDataStore.getState().lastFetchedAt;
    expect(previousLastFetchedAt).not.toBeNull();

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');

    expect(useAaveV4LiveDataStore.getState().status).toBe('error');
    expect(useAaveV4LiveDataStore.getState().lastFetchedAt).toBe(previousLastFetchedAt);
  });

  it('does not crash on a malformed (non-JSON) API response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await useAaveV4LiveDataStore.getState().fetchAaveV4LiveData(VALID_ADDRESS, 'USDC');

    expect(useAaveV4LiveDataStore.getState().status).toBe('error');
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAaveV4CollateralRiskLiveDataStore } from '@/stores/aaveV4CollateralRiskLiveDataStore';

/**
 * Aave V4 Live Collateral-Risk Data Store — V4 Readiness Audit §12 Stage
 * 23F. Mirrors `tests/unit/stores/aaveV4LiveDataStore.test.ts`'s own
 * conventions: `fetch` is mocked directly, the Store always calls the
 * same-origin `/api/aave/v4-collateral-risk` route, never the Aave V4
 * contracts themselves.
 */
const originalFetch = global.fetch;

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045' as const;

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

const INITIAL_STATE = {
  status: 'idle' as const,
  canonical: null,
  userAddress: null,
  errorMessage: null,
  lastFetchedAt: null,
};

function successBody(overrides?: { collateralFactor?: number; dynamicConfigKey?: number }) {
  return {
    ok: true,
    data: {
      raw: {},
      canonical: {
        collateralFactor: overrides?.collateralFactor ?? 0.8,
        dynamicConfigKey: overrides?.dynamicConfigKey ?? 1,
      },
      display: {},
    },
  };
}

beforeEach(() => {
  useAaveV4CollateralRiskLiveDataStore.setState(INITIAL_STATE);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('useAaveV4CollateralRiskLiveDataStore — success', () => {
  it('fetches and stores a ready canonical value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    const state = useAaveV4CollateralRiskLiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.canonical).toEqual({ collateralFactor: 0.8, dynamicConfigKey: 1 });
    expect(state.userAddress).toBe(VALID_ADDRESS);
    expect(state.errorMessage).toBeNull();
  });

  it('stores the exact user-bound dynamicConfigKey the route returned, not a fabricated or reserve-current one', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(successBody({ collateralFactor: 0.73, dynamicConfigKey: 42 })),
      ) as unknown as typeof fetch;

    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    expect(useAaveV4CollateralRiskLiveDataStore.getState().canonical).toEqual({
      collateralFactor: 0.73,
      dynamicConfigKey: 42,
    });
  });

  it('records lastFetchedAt as a real, current ISO timestamp on a successful fetch', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;

    const before = Date.now();
    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);
    const after = Date.now();

    const lastFetchedAt = useAaveV4CollateralRiskLiveDataStore.getState().lastFetchedAt;
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

    const promise = useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);
    expect(useAaveV4CollateralRiskLiveDataStore.getState().status).toBe('loading');

    resolveFetch(jsonResponse(successBody()));
    return promise;
  });

  it('includes the requested userAddress in the fetch URL, and no debtAsset (there is none for this fetch)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(successBody()));
    global.fetch = fetchMock as unknown as typeof fetch;

    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining(`userAddress=${VALID_ADDRESS}`));
    const calledUrl = fetchMock.mock.calls[0]?.[0] as string;
    expect(calledUrl).not.toContain('debtAsset');
  });
});

describe('useAaveV4CollateralRiskLiveDataStore — identity-switch race protection', () => {
  it('a stale in-flight response for one address cannot overwrite a newer response for a different address that resolves first', async () => {
    const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
    const resolvers: Array<(value: Response) => void> = [];
    global.fetch = vi.fn(
      () => new Promise<Response>((resolve) => resolvers.push(resolve)),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);
    const secondPromise = useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(OTHER_ADDRESS);
    expect(resolvers).toHaveLength(2);

    // The newer request (OTHER_ADDRESS) resolves first.
    resolvers[1](jsonResponse(successBody({ collateralFactor: 0.99 })));
    await secondPromise;
    expect(useAaveV4CollateralRiskLiveDataStore.getState().userAddress).toBe(OTHER_ADDRESS);

    // The stale request resolves after — must be discarded entirely.
    resolvers[0](jsonResponse(successBody({ collateralFactor: 0.11 })));
    await firstPromise;

    const state = useAaveV4CollateralRiskLiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.userAddress).toBe(OTHER_ADDRESS);
    expect(state.canonical?.collateralFactor).toBe(0.99);
  });

  it('a stale in-flight failure cannot overwrite a newer success that resolves first', async () => {
    const OTHER_ADDRESS = '0x1111111111111111111111111111111111111111' as const;
    const resolvers: Array<(value: Response) => void> = [];
    const rejecters: Array<(reason: unknown) => void> = [];
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve, reject) => {
          resolvers.push(resolve);
          rejecters.push(reject);
        }),
    ) as unknown as typeof fetch;

    const firstPromise = useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);
    const secondPromise = useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(OTHER_ADDRESS);

    resolvers[1](jsonResponse(successBody()));
    await secondPromise;
    expect(useAaveV4CollateralRiskLiveDataStore.getState().status).toBe('ready');

    rejecters[0](new TypeError('Failed to fetch'));
    await firstPromise;

    const state = useAaveV4CollateralRiskLiveDataStore.getState();
    expect(state.status).toBe('ready');
    expect(state.userAddress).toBe(OTHER_ADDRESS);
  });
});

describe('useAaveV4CollateralRiskLiveDataStore — failure / fallback (never erases prior good data, fail closed)', () => {
  it('sets an error status with a message on a network failure', async () => {
    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;

    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    const state = useAaveV4CollateralRiskLiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe(
      'Live Aave V4 collateral-risk data is temporarily unavailable.',
    );
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

    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    expect(useAaveV4CollateralRiskLiveDataStore.getState().errorMessage).toBe(
      'The configured Aave V4 wallet address is not valid.',
    );
  });

  it('does not erase a previously successful fetch when a later refresh fails — no fallback to a reserve-current or fabricated value', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);
    expect(useAaveV4CollateralRiskLiveDataStore.getState().status).toBe('ready');
    const previous = useAaveV4CollateralRiskLiveDataStore.getState().canonical;

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    const state = useAaveV4CollateralRiskLiveDataStore.getState();
    expect(state.status).toBe('error');
    expect(state.canonical).toEqual(previous);
    expect(state.userAddress).toBe(VALID_ADDRESS);
  });

  it('does not erase a previously recorded lastFetchedAt when a later refresh fails', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(jsonResponse(successBody())) as unknown as typeof fetch;
    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);
    const previousLastFetchedAt = useAaveV4CollateralRiskLiveDataStore.getState().lastFetchedAt;
    expect(previousLastFetchedAt).not.toBeNull();

    global.fetch = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch')) as unknown as typeof fetch;
    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    expect(useAaveV4CollateralRiskLiveDataStore.getState().status).toBe('error');
    expect(useAaveV4CollateralRiskLiveDataStore.getState().lastFetchedAt).toBe(
      previousLastFetchedAt,
    );
  });

  it('does not crash on a malformed (non-JSON) API response', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('not json', { status: 200 })) as unknown as typeof fetch;

    await useAaveV4CollateralRiskLiveDataStore
      .getState()
      .fetchAaveV4CollateralRiskLiveData(VALID_ADDRESS);

    expect(useAaveV4CollateralRiskLiveDataStore.getState().status).toBe('error');
  });
});

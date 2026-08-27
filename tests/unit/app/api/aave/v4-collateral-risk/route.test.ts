import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAaveV4CollateralRiskSnapshot = vi.fn();
const createAaveV4RpcClient = vi.fn().mockReturnValue({});

vi.mock('@/infrastructure/protocols/aave/v4', () => ({
  fetchAaveV4CollateralRiskSnapshot: (...args: unknown[]) =>
    fetchAaveV4CollateralRiskSnapshot(...args),
}));
vi.mock('@/infrastructure/protocols/aave/v4/client', () => ({
  createAaveV4RpcClient: (...args: unknown[]) => createAaveV4RpcClient(...args),
}));

/** R2-1 — see `tests/unit/app/api/aave/_shared/unexpectedErrorBoundary.test.ts` for the boundary's own isolated tests; these assert the real route is actually wired to it. */
const { captureError, logDiagnosticEvent } = vi.hoisted(() => ({
  captureError: vi.fn(),
  logDiagnosticEvent: vi.fn(),
}));
vi.mock('@/services/observability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/observability')>();
  return { ...actual, captureError, logDiagnosticEvent };
});

const VALID_ADDRESS = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

function request(query = ''): Request {
  return new Request(`http://localhost/api/aave/v4-collateral-risk${query}`);
}

beforeEach(() => {
  captureError.mockClear();
  logDiagnosticEvent.mockClear();
});

/**
 * Aave V4 Live Collateral-Risk API route — V4 Readiness Audit §12 Stage
 * 23F. Mirrors `tests/unit/app/api/aave/v4-position/route.test.ts`'s own
 * mocking style exactly: the infrastructure adapter is mocked (not a
 * Service — `services/aave/v4CollateralRisk.ts`'s pure functions run for
 * real here), since the route itself, not a Service, is what calls the
 * adapter.
 */
describe('GET /api/aave/v4-collateral-risk', () => {
  it('returns 400 when the userAddress query param is missing', async () => {
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errors[0].code).toBe('AAVE_V4_MISSING_QUERY_PARAMS');
    expect(fetchAaveV4CollateralRiskSnapshot).not.toHaveBeenCalled();
  });

  it('returns 400, and never calls the adapter, when userAddress is malformed', async () => {
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request('?userAddress=not-an-address'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors[0].code).toBe('AAVE_V4_INVALID_USER_ADDRESS');
    expect(fetchAaveV4CollateralRiskSnapshot).not.toHaveBeenCalled();
  });

  it('forwards userAddress from the query string to the adapter (and only userAddress — no debtAsset) and returns 200 with its data on success', async () => {
    fetchAaveV4CollateralRiskSnapshot.mockResolvedValueOnce({
      ok: true,
      data: {
        raw: {},
        canonical: { collateralFactor: 0.8, dynamicConfigKey: 1 },
        display: { blockNumber: '21000000' },
      },
    });
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.canonical).toEqual({ collateralFactor: 0.8, dynamicConfigKey: 1 });
    expect(fetchAaveV4CollateralRiskSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      VALID_ADDRESS,
    );
  });

  it('returns 503 for a retryable adapter error (RPC timeout/network)', async () => {
    fetchAaveV4CollateralRiskSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'internal detail',
        userMessage: 'Could not reach the Ethereum RPC endpoint. Please try again.',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}`));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.errors[0]).toEqual({
      category: 'provider',
      code: 'AAVE_V4_RPC_NETWORK_ERROR',
      message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
    });
  });

  it('returns 502 for a non-retryable adapter error', async () => {
    fetchAaveV4CollateralRiskSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_DECIMALS_MISMATCH',
        message: 'internal detail',
        userMessage:
          'Aave V4 asset configuration has changed unexpectedly. Please try again later.',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}`));
    expect(response.status).toBe(502);
  });
});

describe('GET /api/aave/v4-collateral-risk — unexpected-exception boundary (R2-1)', () => {
  it('returns a stable 500 fallback, not a raw crash, when the adapter throws instead of returning a classified failure', async () => {
    fetchAaveV4CollateralRiskSnapshot.mockRejectedValueOnce(
      new Error('sensitive internal detail: rpc key leaked'),
    );
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}`));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      errors: [
        {
          category: 'unknown',
          code: 'AAVE_V4_UNEXPECTED_ERROR',
          message: expect.any(String),
        },
      ],
    });
  });

  it('never leaks the thrown exception’s own message into the response body', async () => {
    fetchAaveV4CollateralRiskSnapshot.mockRejectedValueOnce(new Error('sensitive internal detail'));
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}`));
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain('sensitive internal detail');
  });

  it('reports the exception via captureError and logDiagnosticEvent, tagged for the v4-collateral-risk route', async () => {
    const thrown = new Error('boom');
    fetchAaveV4CollateralRiskSnapshot.mockRejectedValueOnce(thrown);
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    await GET(request(`?userAddress=${VALID_ADDRESS}`));

    expect(captureError).toHaveBeenCalledWith(
      thrown,
      expect.objectContaining({
        operation: 'v4-collateral-risk',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
      }),
    );
    expect(logDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'v4-collateral-risk',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
        outcome: 'failure',
      }),
    );
  });

  it('does not fire the unexpected-exception diagnostics for an ordinary classified adapter failure', async () => {
    fetchAaveV4CollateralRiskSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'x',
        userMessage: 'x',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-collateral-risk/route');
    await GET(request(`?userAddress=${VALID_ADDRESS}`));

    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });
});

/**
 * V3/V4-debt isolation — this new route must not alter the V3 route or
 * the pre-existing V4 debt-state route/adapter path, mirroring
 * `tests/unit/app/api/aave/v4-position/route.test.ts`'s own regression
 * check for the V3 route.
 */
describe('GET /api/aave/v4-position — unaffected by the new V4 collateral-risk route (Stage 23F regression check)', () => {
  it('still returns 200 with V4 debt-position adapter data, unchanged', async () => {
    vi.resetModules();
    const fetchAaveV4DebtSnapshot = vi.fn().mockResolvedValueOnce({
      ok: true,
      data: { display: { blockNumber: '21000000' } },
    });
    vi.doMock('@/infrastructure/protocols/aave/v4', () => ({
      fetchAaveV4DebtSnapshot,
    }));
    vi.doMock('@/infrastructure/protocols/aave/v4/client', () => ({
      createAaveV4RpcClient: vi.fn().mockReturnValue({}),
    }));
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(
      new Request(
        `http://localhost/api/aave/v4-position?userAddress=${VALID_ADDRESS}&debtAsset=USDC`,
      ),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.display.blockNumber).toBe('21000000');
    vi.doUnmock('@/infrastructure/protocols/aave/v4');
    vi.doUnmock('@/infrastructure/protocols/aave/v4/client');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAaveV4DebtSnapshot = vi.fn();
const createAaveV4RpcClient = vi.fn().mockReturnValue({});

vi.mock('@/infrastructure/protocols/aave/v4', () => ({
  fetchAaveV4DebtSnapshot: (...args: unknown[]) => fetchAaveV4DebtSnapshot(...args),
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
  return new Request(`http://localhost/api/aave/v4-position${query}`);
}

beforeEach(() => {
  captureError.mockClear();
  logDiagnosticEvent.mockClear();
});

/**
 * Aave V4 Live Position API route — V4 Readiness Audit §12 Stage 4B.
 * Mirrors `tests/unit/app/api/aave/reserve/route.test.ts`'s own mocking
 * style exactly: the infrastructure adapter is mocked (not a Service —
 * `services/aave/v4LivePosition.ts`'s pure functions run for real here),
 * since the route itself, not a Service, is what calls the adapter.
 */
describe('GET /api/aave/v4-position', () => {
  it('returns 400 when both query params are missing', async () => {
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errors[0].code).toBe('AAVE_V4_MISSING_QUERY_PARAMS');
    expect(fetchAaveV4DebtSnapshot).not.toHaveBeenCalled();
  });

  it('returns 400 when userAddress is present but debtAsset is missing', async () => {
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}`));
    expect(response.status).toBe(400);
    expect(fetchAaveV4DebtSnapshot).not.toHaveBeenCalled();
  });

  it('returns 400 when debtAsset is present but userAddress is missing', async () => {
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request('?debtAsset=USDC'));
    expect(response.status).toBe(400);
    expect(fetchAaveV4DebtSnapshot).not.toHaveBeenCalled();
  });

  it('returns 400, and never calls the adapter, when userAddress is malformed (missing/invalid V4 identity)', async () => {
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request('?userAddress=not-an-address&debtAsset=USDC'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.errors[0].code).toBe('AAVE_V4_INVALID_USER_ADDRESS');
    expect(fetchAaveV4DebtSnapshot).not.toHaveBeenCalled();
  });

  it('forwards userAddress/debtAsset from the query string to the adapter and returns 200 with its data on success (supported asset)', async () => {
    fetchAaveV4DebtSnapshot.mockResolvedValueOnce({
      ok: true,
      data: { display: { blockNumber: '21000000' } },
    });
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.display.blockNumber).toBe('21000000');
    expect(fetchAaveV4DebtSnapshot).toHaveBeenCalledWith(expect.anything(), 'USDC', VALID_ADDRESS);
  });

  it("returns 400 for an unsupported-debt-asset adapter failure, not 502/503 — mirroring the V3 route's own client-input distinction", async () => {
    fetchAaveV4DebtSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
        message: 'No live Aave V4 debt reserve is configured for "DAI".',
        userMessage: 'Live Aave V4 data is not yet available for DAI.',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=DAI`));
    expect(response.status).toBe(400);
    // DAI was forwarded as requested — the route never substitutes assets.
    expect(fetchAaveV4DebtSnapshot).toHaveBeenCalledWith(expect.anything(), 'DAI', VALID_ADDRESS);
  });

  it('returns 503 for a retryable adapter error (RPC timeout/network) — adapter failure/error handling', async () => {
    fetchAaveV4DebtSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'internal detail',
        userMessage: 'Could not reach the Ethereum RPC endpoint. Please try again.',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.errors[0]).toEqual({
      category: 'provider',
      code: 'AAVE_V4_RPC_NETWORK_ERROR',
      message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
    });
  });

  it('returns 502 for a non-retryable adapter error (e.g. decimals mismatch) — adapter failure/error handling', async () => {
    fetchAaveV4DebtSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_DECIMALS_MISMATCH',
        message: 'internal detail',
        userMessage:
          'Aave V4 asset configuration has changed unexpectedly. Please try again later.',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));
    expect(response.status).toBe(502);
  });
});

describe('GET /api/aave/v4-position — unexpected-exception boundary (R2-1)', () => {
  it('returns a stable 500 fallback, not a raw crash, when the adapter throws instead of returning a classified failure', async () => {
    fetchAaveV4DebtSnapshot.mockRejectedValueOnce(
      new Error('sensitive internal detail: rpc key leaked'),
    );
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));

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
    fetchAaveV4DebtSnapshot.mockRejectedValueOnce(new Error('sensitive internal detail'));
    const { GET } = await import('@/app/api/aave/v4-position/route');
    const response = await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain('sensitive internal detail');
  });

  it('reports the exception via captureError and logDiagnosticEvent, tagged for the v4-position route', async () => {
    const thrown = new Error('boom');
    fetchAaveV4DebtSnapshot.mockRejectedValueOnce(thrown);
    const { GET } = await import('@/app/api/aave/v4-position/route');
    await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));

    expect(captureError).toHaveBeenCalledWith(
      thrown,
      expect.objectContaining({ operation: 'v4-position', code: 'AAVE_V4_UNEXPECTED_ERROR' }),
    );
    expect(logDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'v4-position',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
        outcome: 'failure',
      }),
    );
  });

  it('does not fire the unexpected-exception diagnostics for an ordinary classified adapter failure', async () => {
    fetchAaveV4DebtSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'x',
        userMessage: 'x',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-position/route');
    await GET(request(`?userAddress=${VALID_ADDRESS}&debtAsset=USDC`));

    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });
});

/**
 * V3 behavior preservation — Stage 4B must not alter the V3 route/adapter
 * path. Mocks the V3 adapter selector exactly like
 * `tests/unit/app/api/aave/reserve/route.test.ts` does independently, and
 * imports the real (unmocked) V3 route module in the same test run as the
 * new V4 route, proving the two coexist without interfering (shared
 * `@/utils/env` now carrying `AAVE_V4_RPC_URL` alongside `AAVE_RPC_URL`,
 * shared `services/index.ts` barrel now re-exporting `./aave`, etc.).
 */
describe('GET /api/aave/reserve — unaffected by the new V4 route (Stage 4B regression check)', () => {
  it('still returns 200 with V3 adapter data, unchanged', async () => {
    vi.resetModules();
    const fetchReserveSnapshot = vi.fn().mockResolvedValueOnce({
      ok: true,
      data: { source: { protocol: 'aave', version: 'v3', blockNumber: '21000000' } },
    });
    vi.doMock('@/infrastructure/protocols/aave', () => ({
      getAaveAdapter: vi.fn().mockReturnValue({ version: 'v3', fetchReserveSnapshot }),
    }));
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET(new Request('http://localhost/api/aave/reserve'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.source.blockNumber).toBe('21000000');
    vi.doUnmock('@/infrastructure/protocols/aave');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAaveV4BaseDrawnRate = vi.fn();
const createAaveV4RpcClient = vi.fn().mockReturnValue({});

vi.mock('@/infrastructure/protocols/aave/v4', () => ({
  fetchAaveV4BaseDrawnRate: (...args: unknown[]) => fetchAaveV4BaseDrawnRate(...args),
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

function request(query = ''): Request {
  return new Request(`http://localhost/api/aave/v4-base-drawn-rate${query}`);
}

/**
 * A realistic, fully-populated success payload — every `raw` field is a
 * genuine `bigint`, exactly as `fetchAaveV4BaseDrawnRate` really returns
 * it (`infrastructure/protocols/aave/v4/types.ts`'s
 * `RawAaveV4BaseDrawnRateSnapshot`) — proves the bigint-safe
 * serialization fix's `toJsonSafe` is actually applied here too, the
 * same way it is for every other V4 route.
 */
function realisticSuccessData() {
  return {
    raw: {
      blockNumber: 21_000_000n,
      blockTimestamp: 1_700_000_000n,
      hub: '0x1111111111111111111111111111111111111111' as const,
      spoke: '0x2222222222222222222222222222222222222222' as const,
      reserveId: 11n,
      drawnRateRay: 40_000_000_000_000_000_000_000_000n,
    },
    canonical: { baseDrawnApr: 0.04 },
    display: {
      network: 'ethereum',
      debtSymbol: 'USDC',
      hub: '0x1111111111111111111111111111111111111111',
      spoke: '0x2222222222222222222222222222222222222222',
      reserveId: '11',
      blockNumber: '21000000',
      blockTimestamp: '2023-11-14T22:13:20.000Z',
    },
  };
}

beforeEach(() => {
  captureError.mockClear();
  logDiagnosticEvent.mockClear();
});

/**
 * Aave V4 wallet-independent base-drawn-rate API route (V4 Manual-Data /
 * Provenance Audit). Mirrors `tests/unit/app/api/aave/v4-reserve-price/route.test.ts`'s
 * own mocking style, plus `../v4-position/route.test.ts`'s own
 * required-query-param coverage (`?debtAsset`, this route's own identity
 * dimension).
 */
describe('GET /api/aave/v4-base-drawn-rate', () => {
  it('returns 400 when the debtAsset query param is missing', async () => {
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request());
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.errors[0].code).toBe('AAVE_V4_MISSING_QUERY_PARAMS');
    expect(fetchAaveV4BaseDrawnRate).not.toHaveBeenCalled();
  });

  it('forwards debtAsset from the query string to the adapter and returns 200 with a fully JSON-serializable body — bigint raw fields become strings', async () => {
    fetchAaveV4BaseDrawnRate.mockResolvedValueOnce({ ok: true, data: realisticSuccessData() });
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request('?debtAsset=USDC'));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.raw).toEqual({
      blockNumber: '21000000',
      blockTimestamp: '1700000000',
      hub: '0x1111111111111111111111111111111111111111',
      spoke: '0x2222222222222222222222222222222222222222',
      reserveId: '11',
      drawnRateRay: '40000000000000000000000000',
    });
    expect(body.data.canonical).toEqual({ baseDrawnApr: 0.04 });
    expect(fetchAaveV4BaseDrawnRate).toHaveBeenCalledWith(expect.anything(), 'USDC');
  });

  it('returns 400 for an unsupported-debt-asset adapter failure, not 502/503', async () => {
    fetchAaveV4BaseDrawnRate.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_UNSUPPORTED_DEBT_ASSET',
        message: 'No live Aave V4 debt reserve is configured for "DAI".',
        userMessage: 'Live Aave V4 data is not yet available for DAI.',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request('?debtAsset=DAI'));
    expect(response.status).toBe(400);
  });

  it('returns 503 for a retryable adapter error (RPC timeout/network)', async () => {
    fetchAaveV4BaseDrawnRate.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'internal detail',
        userMessage: 'Could not reach the Ethereum RPC endpoint. Please try again.',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request('?debtAsset=USDC'));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.errors[0]).toEqual({
      category: 'provider',
      code: 'AAVE_V4_RPC_NETWORK_ERROR',
      message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
    });
  });

  it('returns 502 for a non-retryable adapter error', async () => {
    fetchAaveV4BaseDrawnRate.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: 'internal detail',
        userMessage: 'Live Aave V4 data is not yet available for USDC.',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request('?debtAsset=USDC'));
    expect(response.status).toBe(502);
  });
});

describe('GET /api/aave/v4-base-drawn-rate — unexpected-exception boundary (R2-1)', () => {
  it('returns a stable 500 fallback, not a raw crash, when the adapter throws instead of returning a classified failure', async () => {
    fetchAaveV4BaseDrawnRate.mockRejectedValueOnce(
      new Error('sensitive internal detail: rpc key leaked'),
    );
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request('?debtAsset=USDC'));

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
    fetchAaveV4BaseDrawnRate.mockRejectedValueOnce(new Error('sensitive internal detail'));
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    const response = await GET(request('?debtAsset=USDC'));
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain('sensitive internal detail');
  });

  it('reports the exception via captureError and logDiagnosticEvent, tagged for the v4-base-drawn-rate route', async () => {
    const thrown = new Error('boom');
    fetchAaveV4BaseDrawnRate.mockRejectedValueOnce(thrown);
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    await GET(request('?debtAsset=USDC'));

    expect(captureError).toHaveBeenCalledWith(
      thrown,
      expect.objectContaining({
        operation: 'v4-base-drawn-rate',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
      }),
    );
    expect(logDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'v4-base-drawn-rate',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
        outcome: 'failure',
      }),
    );
  });

  it('does not fire the unexpected-exception diagnostics for an ordinary classified adapter failure', async () => {
    fetchAaveV4BaseDrawnRate.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'x',
        userMessage: 'x',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-base-drawn-rate/route');
    await GET(request('?debtAsset=USDC'));

    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });
});

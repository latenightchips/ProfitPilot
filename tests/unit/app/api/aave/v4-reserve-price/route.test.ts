import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchAaveV4ReservePrice = vi.fn();
const createAaveV4RpcClient = vi.fn().mockReturnValue({});

vi.mock('@/infrastructure/protocols/aave/v4', () => ({
  fetchAaveV4ReservePrice: (...args: unknown[]) => fetchAaveV4ReservePrice(...args),
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

function request(): Request {
  return new Request('http://localhost/api/aave/v4-reserve-price');
}

/**
 * A realistic, fully-populated success payload — every `raw` field is a
 * genuine `bigint`, exactly as `fetchAaveV4ReservePrice` really returns
 * it (`infrastructure/protocols/aave/v4/types.ts`'s
 * `RawAaveV4ReservePriceSnapshot`). The pre-existing sibling route tests
 * only ever exercised `raw: {}` (or omitted it), which is exactly why
 * this route's `NextResponse.json({ ok: true, data: result.data })` was
 * never caught throwing `TypeError: Do not know how to serialize a
 * BigInt` before it shipped — see `./toJsonSafe.test.ts` for the
 * converter's own isolated coverage.
 */
function realisticSuccessData() {
  return {
    raw: {
      blockNumber: 21_000_000n,
      blockTimestamp: 1_700_000_000n,
      spoke: '0x1111111111111111111111111111111111111111' as const,
      collateralReserveId: 11n,
      oracle: '0x9999999999999999999999999999999999999999' as const,
      oraclePriceRaw: 6_900_000_000_000n,
      oracleDecimals: 8,
    },
    canonical: { collateralPriceUsd: 69000 },
    display: {
      network: 'ethereum',
      collateralSymbol: 'WBTC',
      spoke: '0x1111111111111111111111111111111111111111',
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
 * Aave V4 wallet-independent reserve-price API route. Mirrors
 * `tests/unit/app/api/aave/v4-collateral-risk/route.test.ts`'s own
 * mocking style: the infrastructure adapter is mocked, since the route
 * itself is what calls it.
 */
describe('GET /api/aave/v4-reserve-price', () => {
  it('returns 200 with a fully JSON-serializable body — bigint raw fields become strings, canonical/display are untouched', async () => {
    fetchAaveV4ReservePrice.mockResolvedValueOnce({ ok: true, data: realisticSuccessData() });
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.raw).toEqual({
      blockNumber: '21000000',
      blockTimestamp: '1700000000',
      spoke: '0x1111111111111111111111111111111111111111',
      collateralReserveId: '11',
      oracle: '0x9999999999999999999999999999999999999999',
      oraclePriceRaw: '6900000000000',
      oracleDecimals: 8,
    });
    expect(body.data.canonical).toEqual({ collateralPriceUsd: 69000 });
    expect(body.data.display.blockNumber).toBe('21000000');
  });

  it('returns 503 for a retryable adapter error (RPC timeout/network)', async () => {
    fetchAaveV4ReservePrice.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'internal detail',
        userMessage: 'Could not reach the Ethereum RPC endpoint. Please try again.',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    const response = await GET();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.errors[0]).toEqual({
      category: 'provider',
      code: 'AAVE_V4_RPC_NETWORK_ERROR',
      message: 'Could not reach the Ethereum RPC endpoint. Please try again.',
    });
  });

  it('returns 502 for a non-retryable adapter error', async () => {
    fetchAaveV4ReservePrice.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RESERVE_NOT_FOUND',
        message: 'internal detail',
        userMessage: 'Live Aave V4 price data is not yet available for WBTC.',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    const response = await GET();
    expect(response.status).toBe(502);
  });
});

describe('GET /api/aave/v4-reserve-price — unexpected-exception boundary (R2-1)', () => {
  it('returns a stable 500 fallback, not a raw crash, when the adapter throws instead of returning a classified failure', async () => {
    fetchAaveV4ReservePrice.mockRejectedValueOnce(
      new Error('sensitive internal detail: rpc key leaked'),
    );
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    const response = await GET();

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
    fetchAaveV4ReservePrice.mockRejectedValueOnce(new Error('sensitive internal detail'));
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    const response = await GET();
    const body = await response.json();

    expect(JSON.stringify(body)).not.toContain('sensitive internal detail');
  });

  it('reports the exception via captureError and logDiagnosticEvent, tagged for the v4-reserve-price route', async () => {
    const thrown = new Error('boom');
    fetchAaveV4ReservePrice.mockRejectedValueOnce(thrown);
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    await GET();

    expect(captureError).toHaveBeenCalledWith(
      thrown,
      expect.objectContaining({ operation: 'v4-reserve-price', code: 'AAVE_V4_UNEXPECTED_ERROR' }),
    );
    expect(logDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: 'v4-reserve-price',
        code: 'AAVE_V4_UNEXPECTED_ERROR',
        outcome: 'failure',
      }),
    );
  });

  it('does not fire the unexpected-exception diagnostics for an ordinary classified adapter failure', async () => {
    fetchAaveV4ReservePrice.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_V4_RPC_NETWORK_ERROR',
        message: 'x',
        userMessage: 'x',
        retryable: true,
      },
    });
    const { GET } = await import('@/app/api/aave/v4-reserve-price/route');
    await GET();

    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });
});

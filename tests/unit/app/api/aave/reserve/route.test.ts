import { describe, expect, it, vi } from 'vitest';

const fetchReserveSnapshot = vi.fn();
const getAaveAdapter = vi.fn().mockReturnValue({ version: 'v3', fetchReserveSnapshot });

vi.mock('@/infrastructure/protocols/aave', () => ({
  getAaveAdapter: (...args: unknown[]) => getAaveAdapter(...args),
}));

function request(query = ''): Request {
  return new Request(`http://localhost/api/aave/reserve${query}`);
}

describe('GET /api/aave/reserve', () => {
  it('returns 200 with the adapter data on success', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({
      ok: true,
      data: {
        source: {
          protocol: 'aave',
          version: 'v3',
          network: 'Ethereum Mainnet',
          method: 'rpc',
          blockNumber: '21000000',
        },
      },
    });
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET(request());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.data.source.blockNumber).toBe('21000000');
  });

  it('returns 503 for a retryable adapter error', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({
      ok: false,
      error: { code: 'AAVE_RPC_NETWORK_ERROR', message: 'x', userMessage: 'x', retryable: true },
    });
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET(request());
    expect(response.status).toBe(503);
  });

  it('returns 502 for a non-retryable adapter error (e.g. decimals mismatch)', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({
      ok: false,
      error: { code: 'AAVE_DECIMALS_MISMATCH', message: 'x', userMessage: 'x', retryable: false },
    });
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET(request());
    expect(response.status).toBe(502);
  });

  it('passes version "v3" to the adapter selector', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({ ok: true, data: {} });
    const { GET } = await import('@/app/api/aave/reserve/route');
    await GET(request());
    expect(getAaveAdapter).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3' }));
  });
});

describe('GET /api/aave/reserve — ?borrowAsset (USDT Support milestone)', () => {
  it('defaults to USDC when the query param is omitted, for backward compatibility', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({ ok: true, data: {} });
    const { GET } = await import('@/app/api/aave/reserve/route');
    await GET(request());
    expect(fetchReserveSnapshot).toHaveBeenCalledWith('USDC');
  });

  it('forwards an explicit ?borrowAsset=USDT to the adapter', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({ ok: true, data: {} });
    const { GET } = await import('@/app/api/aave/reserve/route');
    await GET(request('?borrowAsset=USDT'));
    expect(fetchReserveSnapshot).toHaveBeenCalledWith('USDT');
  });

  it('returns 400, not 502/503, when the adapter reports an unsupported borrow asset — a client input problem, not an upstream one', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_UNSUPPORTED_BORROW_ASSET',
        message: 'x',
        userMessage: 'x',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET(request('?borrowAsset=DAI'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AAVE_UNSUPPORTED_BORROW_ASSET');
    // DAI was forwarded as requested — the route itself never substitutes
    // USDC (or any other asset) on the caller's behalf.
    expect(fetchReserveSnapshot).toHaveBeenCalledWith('DAI');
  });

  it('returns 400 for a completely unrecognized borrowAsset value, not just DAI specifically', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({
      ok: false,
      error: {
        code: 'AAVE_UNSUPPORTED_BORROW_ASSET',
        message: 'x',
        userMessage: 'x',
        retryable: false,
      },
    });
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET(request('?borrowAsset=NOT_A_REAL_ASSET'));
    expect(response.status).toBe(400);
  });
});

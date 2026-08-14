import { describe, expect, it, vi } from 'vitest';

const fetchReserveSnapshot = vi.fn();
const getAaveAdapter = vi.fn().mockReturnValue({ version: 'v3', fetchReserveSnapshot });

vi.mock('@/infrastructure/protocols/aave', () => ({
  getAaveAdapter: (...args: unknown[]) => getAaveAdapter(...args),
}));

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
    const response = await GET();
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
    const response = await GET();
    expect(response.status).toBe(503);
  });

  it('returns 502 for a non-retryable adapter error (e.g. decimals mismatch)', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({
      ok: false,
      error: { code: 'AAVE_DECIMALS_MISMATCH', message: 'x', userMessage: 'x', retryable: false },
    });
    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET();
    expect(response.status).toBe(502);
  });

  it('passes version "v3" to the adapter selector', async () => {
    fetchReserveSnapshot.mockResolvedValueOnce({ ok: true, data: {} });
    const { GET } = await import('@/app/api/aave/reserve/route');
    await GET();
    expect(getAaveAdapter).toHaveBeenCalledWith(expect.objectContaining({ version: 'v3' }));
  });
});

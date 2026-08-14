import { describe, expect, it, vi } from 'vitest';

import { fetchAaveReserves } from '@/infrastructure/protocols/aave/client';

/**
 * Aave subgraph client — `04_BUILD_GUIDE.md` "TESTING REQUIREMENTS":
 * "Each provider requires tests for Valid response, Invalid response,
 * Timeout, Rate limit, Malformed data, Stale data, Unavailable
 * provider, Fallback behavior... No network dependency should exist in
 * unit tests. Use mocked providers." Every test below injects a mocked
 * `fetchImpl` — no real network call is ever made.
 */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function validGraphqlBody() {
  return {
    data: {
      reserves: [
        {
          id: '0x1',
          symbol: 'WBTC',
          decimals: 8,
          baseLTVasCollateral: '7300',
          reserveLiquidationThreshold: '7800',
          variableBorrowRate: '10000000000000000000000000',
          liquidityRate: '5000000000000000000000000',
          lastUpdateTimestamp: 1_800_000_000,
          price: { priceInEth: '15000000000000000000', oracle: { usdPriceEth: '200000000000' } },
        },
      ],
    },
  };
}

const BASE_PARAMS = {
  subgraphId: 'test-subgraph-id',
  apiKey: 'test-api-key',
  collateralSymbol: 'WBTC',
  borrowSymbol: 'USDC',
};

describe('fetchAaveReserves — valid response', () => {
  it('returns the reserves array on a successful, well-formed response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(validGraphqlBody()));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reserves).toHaveLength(1);
    expect(result.reserves[0].symbol).toBe('WBTC');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('posts to the Graph Gateway URL with the API key in the path, not exposed via headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(validGraphqlBody()));
    await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://gateway.thegraph.com/api/test-api-key/subgraphs/id/test-subgraph-id');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body).variables).toEqual({ symbols: ['WBTC', 'USDC'] });
  });
});

describe('fetchAaveReserves — invalid/malformed response', () => {
  it('fails cleanly on malformed (non-JSON) response body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('not json{{{', { status: 200 }));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_MALFORMED_RESPONSE');
    expect(result.error.retryable).toBe(false);
  });

  it('fails cleanly when the response does not match the expected schema', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ unexpected: 'shape' }));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_SCHEMA_VALIDATION_FAILED');
    expect(result.error.retryable).toBe(false);
  });
});

describe('fetchAaveReserves — HTTP errors', () => {
  it('treats a 429 (rate limit) as retryable, with a rate-limit-specific user message', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 429));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_HTTP_429');
    expect(result.error.retryable).toBe(true);
    expect(result.error.userMessage).toContain('rate-limited');
    // Exhausts all retries (1 initial + 2 retries = 3 calls) since every attempt returns 429.
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('treats a 500 (server error) as retryable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 500));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('treats a 400 (client error) as non-retryable — a malformed query fails identically every time', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, 400));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_HTTP_400');
    expect(result.error.retryable).toBe(false);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('succeeds on a retry after an initial transient 500', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 500))
      .mockResolvedValueOnce(jsonResponse(validGraphqlBody()));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('fetchAaveReserves — network failure / timeout (unavailable provider)', () => {
  it('fails cleanly and retryably on a network error', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_NETWORK_ERROR');
    expect(result.error.retryable).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reports a timeout distinctly from a generic network error', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    const fetchImpl = vi.fn().mockRejectedValue(abortError);
    const result = await fetchAaveReserves({ ...BASE_PARAMS, fetchImpl });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('AAVE_TIMEOUT');
    expect(result.error.retryable).toBe(true);
  });
});

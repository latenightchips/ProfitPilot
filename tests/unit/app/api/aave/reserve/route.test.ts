import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * `/api/aave/reserve` — server-only Route Handler. `THEGRAPH_API_KEY`
 * (`utils/env.ts`) is mocked per test rather than read from a real
 * `.env` file — no network dependency, no real secret involved.
 */
function mockEnv(apiKey: string | undefined) {
  vi.doMock('@/utils/env', () => ({
    env: {
      NEXT_PUBLIC_APP_NAME: 'ProfitPilot',
      NEXT_PUBLIC_DEFAULT_CURRENCY: 'USD',
      NEXT_PUBLIC_PRICE_API_URL: '',
      COINGECKO_API_KEY: undefined,
      NEXT_PUBLIC_SUPABASE_URL: '',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: undefined,
      NEXT_PUBLIC_SENTRY_DSN: '',
      THEGRAPH_API_KEY: apiKey,
    },
  }));
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
        {
          id: '0x2',
          symbol: 'USDC',
          decimals: 6,
          baseLTVasCollateral: '0',
          reserveLiquidationThreshold: '0',
          variableBorrowRate: '50000000000000000000000000',
          liquidityRate: '30000000000000000000000000',
          lastUpdateTimestamp: 1_800_000_000,
          price: { priceInEth: '500000000000000', oracle: { usdPriceEth: '200000000000' } },
        },
      ],
    },
  };
}

const originalFetch = global.fetch;

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.doUnmock('@/utils/env');
});

describe('GET /api/aave/reserve — not configured', () => {
  it('returns a clean, non-retryable "not configured" error when THEGRAPH_API_KEY is unset', async () => {
    mockEnv(undefined);
    const { GET } = await import('@/app/api/aave/reserve/route');

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AAVE_NOT_CONFIGURED');
    expect(body.error.retryable).toBe(false);
  });

  it('never mentions the missing key or any implementation detail in the user-facing message', async () => {
    mockEnv('');
    const { GET } = await import('@/app/api/aave/reserve/route');

    const response = await GET();
    const body = await response.json();

    expect(body.error.userMessage).not.toMatch(/key|env|THEGRAPH/i);
  });
});

describe('GET /api/aave/reserve — configured, successful fetch', () => {
  it('returns mapped price/protocol candidates on success', async () => {
    mockEnv('real-test-key');
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(validGraphqlBody()), { status: 200 }),
      ) as unknown as typeof fetch;

    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.collateralSymbol).toBe('WBTC');
    expect(body.data.borrowSymbol).toBe('USDC');
    expect(body.data.priceCandidate.origin).toBe('provider');
    expect(body.data.protocolCandidate.origin).toBe('live');
    expect(body.data.protocolCandidate.parameters.maxLoanToValue).toBeCloseTo(0.73, 6);
  });
});

describe('GET /api/aave/reserve — configured, provider failure', () => {
  it('passes through a clean provider error without leaking internal details', async () => {
    mockEnv('real-test-key');
    global.fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 500 })) as unknown as typeof fetch;

    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('AAVE_HTTP_500');
    expect(body.error.retryable).toBe(true);
    expect(JSON.stringify(body)).not.toContain('real-test-key');
  });

  it("returns a clean error when the market's expected reserves are missing from an otherwise-valid response", async () => {
    mockEnv('real-test-key');
    global.fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { reserves: [] } }), { status: 200 }),
      ) as unknown as typeof fetch;

    const { GET } = await import('@/app/api/aave/reserve/route');
    const response = await GET();
    const body = await response.json();

    expect(body.ok).toBe(false);
    expect(body.error.retryable).toBe(false);
  });
});

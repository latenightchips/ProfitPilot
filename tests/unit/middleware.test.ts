import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import {
  buildAaveRateLimitResponse,
  config,
  evaluateAaveApiRequest,
  middleware,
} from '@/middleware';
import { AAVE_RATE_LIMIT, FixedWindowRateLimiter } from '@/services/rateLimit';

/**
 * `middleware.ts` — R1-2 ("Protect Aave API Boundary + Least-Privilege
 * CI"). `evaluateAaveApiRequest`/`buildAaveRateLimitResponse` live in
 * this file (not under `services/`) because they import `NextResponse`
 * — see `middleware.ts`'s own header comment for the M3-001 boundary
 * reasoning. Every test below drives time via a manually advanced fake
 * clock injected into its own fresh `FixedWindowRateLimiter`, never a
 * real timer/sleep, and never the production singleton (so tests never
 * interfere with each other's accumulated state).
 */
function fakeClock(startAt = 0): { now: () => number; advance: (ms: number) => void } {
  let currentTime = startAt;
  return {
    now: () => currentTime,
    advance: (ms: number) => {
      currentTime += ms;
    },
  };
}

function headersFrom(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe('middleware config', () => {
  it('is scoped to /api/aave/* only — Next.js never invokes this function for any other path', () => {
    expect(config.matcher).toEqual(['/api/aave/:path*']);
  });
});

describe('buildAaveRateLimitResponse', () => {
  it('returns 429 with a stable, machine-readable error body', async () => {
    const response = buildAaveRateLimitResponse(42);
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toEqual({
      ok: false,
      error: { code: 'AAVE_RATE_LIMITED', message: expect.any(String) },
    });
  });

  it('sets a Retry-After header matching the given seconds', () => {
    const response = buildAaveRateLimitResponse(17);
    expect(response.headers.get('Retry-After')).toBe('17');
  });

  it('never exposes RPC URLs, credentials, or internal detail in the body', async () => {
    const response = buildAaveRateLimitResponse(5);
    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/rpc|url|key|token|secret/i);
  });
});

describe('evaluateAaveApiRequest', () => {
  it('returns null (proceed) for requests within the limit', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000, now: clock.now });
    const headers = headersFrom({ 'x-forwarded-for': '203.0.113.1' });

    expect(evaluateAaveApiRequest(headers, limiter)).toBeNull();
    expect(evaluateAaveApiRequest(headers, limiter)).toBeNull();
    expect(evaluateAaveApiRequest(headers, limiter)).toBeNull();
  });

  it('returns a 429 response once the limit is exceeded', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 60_000, now: clock.now });
    const headers = headersFrom({ 'x-forwarded-for': '203.0.113.2' });

    evaluateAaveApiRequest(headers, limiter);
    evaluateAaveApiRequest(headers, limiter);
    const blocked = evaluateAaveApiRequest(headers, limiter);

    expect(blocked).not.toBeNull();
    expect(blocked?.status).toBe(429);
  });

  it('does not let independent client identities consume each other’s allowance', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
    const clientA = headersFrom({ 'x-forwarded-for': '203.0.113.3' });
    const clientB = headersFrom({ 'x-forwarded-for': '203.0.113.4' });

    expect(evaluateAaveApiRequest(clientA, limiter)).toBeNull();
    // client A is now at its limit, but client B has its own, untouched budget.
    expect(evaluateAaveApiRequest(clientB, limiter)).toBeNull();
    expect(evaluateAaveApiRequest(clientA, limiter)?.status).toBe(429);
  });

  it('allows requests again after the window resets, using fake time only', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000, now: clock.now });
    const headers = headersFrom({ 'x-forwarded-for': '203.0.113.5' });

    expect(evaluateAaveApiRequest(headers, limiter)).toBeNull();
    expect(evaluateAaveApiRequest(headers, limiter)?.status).toBe(429);

    clock.advance(60_000);

    expect(evaluateAaveApiRequest(headers, limiter)).toBeNull();
  });

  it('includes a valid Retry-After header on the blocked response', () => {
    const clock = fakeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 30_000, now: clock.now });
    const headers = headersFrom({ 'x-forwarded-for': '203.0.113.6' });

    evaluateAaveApiRequest(headers, limiter);
    clock.advance(5_000);
    const blocked = evaluateAaveApiRequest(headers, limiter);

    expect(blocked?.headers.get('Retry-After')).toBe('25');
  });
});

describe('middleware — wiring to the production singleton', () => {
  function requestWithIdentity(identity: string): NextRequest {
    return new NextRequest('http://localhost/api/aave/reserve', {
      headers: { 'x-forwarded-for': identity },
    });
  }

  it('passes a request through (not a 429) while under the limit', () => {
    const response = middleware(requestWithIdentity('198.51.100.10'));
    expect(response.status).not.toBe(429);
  });

  it('returns 429 once a single client exceeds the configured limit', () => {
    const identity = '198.51.100.11';
    let lastResponse = middleware(requestWithIdentity(identity));
    for (let i = 0; i < AAVE_RATE_LIMIT; i += 1) {
      lastResponse = middleware(requestWithIdentity(identity));
    }
    expect(lastResponse.status).toBe(429);
  });
});

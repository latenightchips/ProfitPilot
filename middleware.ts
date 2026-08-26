import { type NextRequest, NextResponse } from 'next/server';

import {
  aaveRateLimiter,
  type FixedWindowRateLimiter,
  resolveAaveClientIdentity,
} from '@/services/rateLimit';

/**
 * Root Next.js middleware — R1-2 ("Protect Aave API Boundary +
 * Least-Privilege CI"). The first (and, as of this batch, only) file of
 * this kind in the repository — `next.config.ts`'s own security-headers
 * comment previously confirmed "no `middleware.ts` anywhere in this
 * repository," true before this batch.
 *
 * **Scoped to `/api/aave/*` only, via `config.matcher` below** — Next.js
 * itself only ever invokes this function for a request whose path
 * matches, so every other route is untouched, with no per-route opt-in
 * code to remember to add elsewhere.
 *
 * **Owns the Next.js-specific response-building; `services/rateLimit/`
 * owns the policy.** `evaluateAaveApiRequest`/`buildAaveRateLimitResponse`
 * live here, not under `services/`, because they import `NextResponse`
 * from `next/server` — `tests/unit/services/serviceFoundation.test.ts`'s
 * M3-001 regression check permanently forbids any Next.js/React import
 * under `services/` (the same discipline that keeps every existing
 * Service framework-free), so this is the correct side of that boundary
 * for them to live on, mirroring how the three Aave route handlers
 * under `app/api/aave/` already import `NextResponse` directly rather
 * than through a Service. The
 * limit, window, singleton limiter, and client-identity resolution
 * (the actual policy, and its documented rationale/limitations) stay in
 * `services/rateLimit/aaveApiRateLimit.ts` — see that file's own header
 * comment for the full accounting, not repeated here.
 */
export interface AaveRateLimitErrorResponse {
  ok: false;
  error: {
    code: 'AAVE_RATE_LIMITED';
    message: string;
  };
}

const RATE_LIMIT_MESSAGE =
  'Too many Aave requests from this client. Please wait and try again shortly.';

export function buildAaveRateLimitResponse(
  retryAfterSeconds: number,
): NextResponse<AaveRateLimitErrorResponse> {
  return NextResponse.json(
    { ok: false, error: { code: 'AAVE_RATE_LIMITED', message: RATE_LIMIT_MESSAGE } },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
  );
}

/**
 * The one function `middleware` below calls. Returns the 429 response
 * to send when the request should be blocked, or `null` when it should
 * proceed unmodified.
 *
 * `limiter` defaults to `services/rateLimit`'s own singleton (the real,
 * `Date.now`-backed instance production traffic actually consumes) but
 * accepts an injected limiter so tests can exercise this exact
 * function — identity resolution, the allow/block decision, and the
 * response it builds — against a limiter constructed with a fake,
 * manually-advanced clock, deterministically, with no real
 * timers/sleeps (`tests/unit/middleware.test.ts`).
 */
export function evaluateAaveApiRequest(
  headers: Headers,
  limiter: FixedWindowRateLimiter = aaveRateLimiter,
): NextResponse<AaveRateLimitErrorResponse> | null {
  const identity = resolveAaveClientIdentity(headers);
  const result = limiter.consume(identity);
  if (result.allowed) return null;
  return buildAaveRateLimitResponse(result.retryAfterSeconds);
}

export function middleware(request: NextRequest): NextResponse {
  return evaluateAaveApiRequest(request.headers) ?? NextResponse.next();
}

export const config = {
  matcher: ['/api/aave/:path*'],
};

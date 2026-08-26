/**
 * Rate limiting — public entry point. R1-2 ("Protect Aave API Boundary +
 * Least-Privilege CI"). See `./fixedWindowRateLimiter.ts` (the generic,
 * protocol-agnostic counter) and `./aaveApiRateLimit.ts` (the Aave-
 * specific policy: limit, window, singleton, client identity) for the
 * full reasoning behind each export. The Next.js-specific response
 * building this policy feeds into lives in `middleware.ts` (repo root),
 * not here — see that file's own header comment for why.
 */
export {
  AAVE_RATE_LIMIT,
  AAVE_RATE_LIMIT_WINDOW_MS,
  aaveRateLimiter,
  resolveAaveClientIdentity,
} from './aaveApiRateLimit';
export {
  FixedWindowRateLimiter,
  type FixedWindowRateLimiterOptions,
  type RateLimitResult,
} from './fixedWindowRateLimiter';

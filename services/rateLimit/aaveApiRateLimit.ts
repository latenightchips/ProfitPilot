import { FixedWindowRateLimiter } from './fixedWindowRateLimiter';

/**
 * Aave API rate-limit policy — R1-2 ("Protect Aave API Boundary +
 * Least-Privilege CI"). Closes the R1-1 audit finding: `/api/aave/reserve`,
 * `/api/aave/v4-position`, and `/api/aave/v4-collateral-risk` are public,
 * unauthenticated `GET` routes that each proxy one live RPC call — with
 * `AAVE_RPC_URL`/`AAVE_V4_RPC_URL` unset (the shipped default) they share
 * a free public endpoint; once a deployer configures either to a paid,
 * key-embedded provider, these routes become an unmetered open proxy to
 * that quota for anyone who can reach the deployed app. This module
 * defines the policy (the limit, the window, the shared singleton
 * limiter, and client identity resolution); `middleware.ts` (repo root)
 * is the one caller, and owns the Next.js-specific response-building
 * this module deliberately does not — see that file's own header
 * comment. **Framework-free by construction**, like every other
 * `services/` module: no `next`/`react` import anywhere in this file,
 * enforced by `tests/unit/services/serviceFoundation.test.ts`'s M3-001
 * regression check (the same discipline `services/aave/v4LivePosition.ts`
 * already follows for RPC-adjacent Service code — see that file's own
 * comment on why `infrastructure/` calls happen one layer up, never
 * here).
 *
 * **One shared bucket across all three routes, not one per route.** The
 * underlying concern — protecting whatever RPC endpoint/quota is
 * configured — is the same across `reserve`/`v4-position`/
 * `v4-collateral-risk` even though V3 and V4 read different env vars, so
 * a client hammering any mix of the three is throttled by one combined
 * budget rather than getting 3× the effective allowance by spreading
 * requests across routes.
 *
 * **Limit chosen from actual legitimate usage, not guessed.** No hook in
 * this codebase polls these routes — `hooks/useAaveLiveSync.ts`/
 * `useAaveV4LiveSync.ts`/`useAaveV4CollateralRiskLiveSync.ts` each fetch
 * once per mount (address save, page navigation, manual remount), never
 * on an interval. A single portfolio page load can call at most 3 of
 * these routes; `components/aave/AaveV4LiveErrorNotice.tsx`'s own header
 * comment documents up to 6 mount points (Portfolio, Dashboard,
 * Simulation, Loop Builder, Exit Planner, Recommendations) across the
 * app. `AAVE_RATE_LIMIT`/`AAVE_RATE_LIMIT_WINDOW_MS` below (30 requests
 * per 60 seconds per client) comfortably covers many page loads/reloads
 * a minute from one real user — including several behind a shared NAT —
 * while still capping sustained scripted abuse to roughly one request
 * every two seconds on average.
 *
 * **Client identity — best-effort, explicitly not trustworthy against a
 * determined attacker.** `NextRequest` in this Next.js version no longer
 * exposes a platform-verified `.ip` (removed upstream); the only signal
 * available to a portable, deployment-agnostic app is the
 * `x-forwarded-for`/`x-real-ip` request headers, which are only as
 * trustworthy as whatever reverse proxy sits in front of this app.
 * Behind a proxy that appends/overwrites the header with the real
 * connecting IP (Vercel's edge network, a correctly configured
 * nginx/Cloudflare front end), this is a meaningful, real per-client
 * signal. Self-hosted with **no** reverse proxy — or behind one that
 * blindly forwards whatever a client sends — `x-forwarded-for` is
 * entirely attacker-controlled: a script can rotate a new fake value on
 * every request and never be throttled by identity at all. This module
 * does not attempt to detect or compensate for that (no IP-format
 * validation, no proxy-chain trust configuration — that is deployment
 * topology this app cannot know from inside a request handler). It is
 * therefore explicitly a defense-in-depth control, not a guarantee: real
 * protection against a sophisticated, identity-rotating attacker
 * requires deployment/platform-level rate limiting (a CDN, an API
 * gateway, or the hosting platform's own edge rate limiting), documented
 * as a recommendation, not implemented here, in
 * `docs/OPERATIONAL_RUNBOOK.md`'s "Aave API rate limiting" section.
 *
 * **Process-local, not distributed — see `./fixedWindowRateLimiter.ts`'s
 * own header comment for the full accounting.** On a single
 * long-running Node process (the common self-hosted `next start` case)
 * this is fully consistent. Across multiple concurrent instances
 * (horizontally-scaled serverless invocations, multi-region edge, load-
 * balanced replicas) each instance enforces the limit independently, so
 * this is not a substitute for a shared store (Redis, a platform-
 * provided distributed limiter) in that topology — a limitation this
 * module states honestly rather than papering over.
 */
export const AAVE_RATE_LIMIT = 30;
export const AAVE_RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * The one production instance `middleware.ts` consumes by default — a
 * real, `Date.now`-backed limiter shared across every request this
 * process handles for `/api/aave/*`. Tests construct their own,
 * separate `FixedWindowRateLimiter` with a fake clock instead of using
 * this singleton, so this instance's own accumulated state never leaks
 * into or out of a test run.
 */
export const aaveRateLimiter = new FixedWindowRateLimiter({
  limit: AAVE_RATE_LIMIT,
  windowMs: AAVE_RATE_LIMIT_WINDOW_MS,
});

/**
 * Best-effort client identity from forwarded-IP headers — see this
 * file's own header comment for the full trust discussion.
 * `x-forwarded-for` may carry a comma-separated hop chain
 * (`client, proxy1, proxy2`); the first entry is used, the conventional
 * position for the originating client. Falls back to `x-real-ip` (set
 * by some reverse proxies, e.g. nginx, instead of `x-forwarded-for`),
 * and finally to a single shared `'unknown'` bucket when neither header
 * is present at all — an honest degradation to a de-facto *global*
 * budget for that traffic (still meaningfully better than no limit),
 * not a silent bypass.
 */
export function resolveAaveClientIdentity(headers: Headers): string {
  const forwardedFor = headers.get('x-forwarded-for');
  if (forwardedFor !== null) {
    const first = forwardedFor.split(',')[0]?.trim();
    if (first !== undefined && first !== '') return first;
  }

  const realIp = headers.get('x-real-ip');
  if (realIp !== null && realIp.trim() !== '') return realIp.trim();

  return 'unknown';
}

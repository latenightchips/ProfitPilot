# Production Readiness Audit

`06_TASKS.md` M10-005 ("Configure Production Environment") — Milestone
10 Batch 1. Dependencies: M10-002. Description: "Verify production
configuration." Review: environment variables, Supabase configuration,
deployment secrets, security headers, caching, build configuration. DoD:
"Production configuration matches Build Guide requirements."

**Scope note, per explicit release decision**: no publicly operated
production deployment exists for Version 1.0.0, and none is being
created by this batch (see `docs/RELEASE_NOTES.md`'s "Deployment"
section and `CONTRIBUTING.md`'s "Deployment" section). This document
audits every component of production readiness that can be honestly
verified **without** external infrastructure — everything the repository
itself controls. Components that require a live, operated deployment
(hosted secrets, a real Supabase project, a real Sentry project, real
production traffic) are explicitly marked **Deferred by explicit
product/release decision — no operated production deployment exists for
Version 1.0.0**, not "N/A" (that term is reserved for Cloud Database/
Cloud Sync, which are permanently cancelled by a separate, earlier
product decision — Milestone 8 — not merely not-yet-operated).

## 1. Environment variables

`.env.example` (repository root) documents every environment variable
this application reads, cross-checked against `utils/env.ts`'s own Zod
schema (the actual runtime validation, not just the example file) and
`04_BUILD_GUIDE.md`'s own "REQUIRED ENVIRONMENT VARIABLES" section:

| Variable | In `.env.example` | In `utils/env.ts` schema | Required for Manual Mode | Notes |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_NAME` | Yes | Yes | No (defaults to `'ProfitPilot'`) | — |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | Yes | Yes | No (defaults to `'USD'`) | — |
| `NEXT_PUBLIC_PRICE_API_URL` | Yes | Yes | No, optional | Not in the Build Guide's own minimal example list; present because a future price provider integration would need it — currently unused (no `PriceProvider`/CoinGecko adapter exists) |
| `COINGECKO_API_KEY` | Yes | Yes | No, optional | Matches the Build Guide's own "(Future)" annotation — genuinely not used by any code path today |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | No, optional (dormant Auth) | Build Guide names this `SUPABASE_URL` (unprefixed) — corrected to `NEXT_PUBLIC_`-prefixed as a deliberate, already-documented fix (M9-030; `PROJECT_STATUS.md`'s "Deviations from a literal reading of the docs"), not an oversight |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes | No, optional (dormant Auth) | Same `NEXT_PUBLIC_` correction as above |
| `NEXT_PUBLIC_SENTRY_DSN` | Yes | Yes | No, optional (dormant monitoring) | Build Guide names this `SENTRY_DSN` — built `NEXT_PUBLIC_`-prefixed from the start (M9-049), same reasoning |

**Result**: every variable this application actually reads is documented
in `.env.example`, and every variable is optional — Manual Mode (Version
1.0.0's only shipped mode) requires none of them, confirmed by
`utils/env.ts`'s own schema (every field has `.default()` or
`.optional()`). No undocumented variable was found by inspection of
`grep -rn "process.env\." --include="*.ts" --include="*.tsx"`. **Status:
Verified.**

## 2. Supabase configuration

`services/auth/supabaseClient.ts`'s `getSupabaseClient()` returns `null`
when `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` are unset
— confirmed in this environment (`.env.local` does not exist; neither
variable is set). The code path is verified correct (`services/auth/authService.test.ts`'s
own "Supabase not configured (client: null)" test suite, already passing)
and gracefully degrades rather than throwing. **Actually configuring a
real Supabase project — creating the project, obtaining its real URL/anon
key, and setting them in a real deployment's environment — is Deferred by
explicit product/release decision — no operated production deployment
exists for Version 1.0.0.** No Supabase project was created by this
batch, per explicit instruction.

## 3. Deployment secrets

No deployment secret (a hosting platform's own environment-variable
store, a CI/CD secret, a domain's TLS certificate) exists for this
project, because no deployment exists. This is **Deferred by explicit
product/release decision — no operated production deployment exists for
Version 1.0.0.** The repository itself contains no committed secret —
confirmed by this project's own standing security review
(`docs/SECURITY_REVIEW.md`) and re-confirmed by grep across the working
tree for common secret patterns finding none, consistent with every
prior batch's own review.

## 4. Security headers

`next.config.ts`'s `headers()` function (Milestone 9 Batch 6, M9-035;
`Permissions-Policy` added by R2-3, "Add Minimal Permissions-Policy
Browser Hardening") is the actual, shipped configuration. **Freshly
re-verified** against a real local production build and server (`pnpm
build && pnpm start`, `curl -sI`) — this is production-*mode*
verification, cited here as repository-level readiness evidence only,
**not** as production-*deployment* verification (no deployment exists
to verify):

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;
  connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(),
  magnetometer=(), gyroscope=(), accelerometer=()
```

Matches `next.config.ts`'s own source exactly, on every route tested
(`/`, and confirmed identically on other routes in Milestone 9 Batch 11's
own verification). `connect-src` correctly resolves to `'self'` alone in
this environment, since `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_PRICE_API_URL`/
`NEXT_PUBLIC_SENTRY_DSN` are all unset — a real deployment that sets any
of them gets that origin added automatically (`next.config.ts`'s own
`connectSrc()` function), no code change required. HSTS deliberately
omits `preload` — a documented, deliberate per-deployment decision left
to whoever actually owns a domain (`next.config.ts`'s own header
comment), not something this repository can or should decide on behalf
of a future deployer. **Status: Verified, matches Build Guide
requirements** (`04_BUILD_GUIDE.md`'s own Security Checklist — HTTPS
enforcement present at the header level; "Row Level Security enabled" is
separately N/A, Cloud Database cancelled).

## 5. Caching

No custom caching configuration exists in `next.config.ts` — none is
needed. **Freshly verified this batch** against the same local production
build: every route is statically prerendered (`○ (Static)` in the real
`pnpm build` output, all 12 routes), and the real server response
confirms Next.js's own default static-asset caching is active and
correct:

- A hashed static asset (`/_next/static/chunks/*.js`) returns
  `Cache-Control: public, max-age=31536000, immutable` — correct for
  content-addressed, never-changing files.
- The prerendered `/` page returns `Cache-Control: s-maxage=31536000`
  plus Next.js's own `x-nextjs-cache: HIT`/`x-nextjs-prerender: 1`
  headers, confirming the static-generation cache is actually active
  in production mode, not just configured.

No application-specific caching decision is needed beyond what a fully
static Next.js build already provides by default. **Status: Verified —
no gap found.**

## 6. Build configuration

`package.json`'s `build`/`start` scripts (`next build --turbopack` /
`next start`) are the entire build/run pipeline — no `vercel.json`, no
platform-specific configuration file exists anywhere in the repository
(confirmed by direct inspection). This matches `04_BUILD_GUIDE.md`'s own
"avoid vendor lock-in whenever practical" principle under "DEPLOYMENT
PLATFORM": the build is portable to Vercel, a Docker/self-hosted
container, Cloudflare, or Netlify without any platform-specific file to
add or remove first. The Build Guide's own "BUILD PROCESS" pipeline
(Install → Type Check → Lint → Run Tests → Production Build → Deploy →
Health Check → Ready) matches this repository's `pnpm validate` script
and `.github/workflows/ci.yml` exactly through "Production Build" —
"Deploy" and "Health Check" are the two steps requiring an actual
deployment target, Deferred per the same release decision as above.
**Status: Verified — portable, no vendor lock-in, matches Build Guide
through the build step.**

**Update (post-M10 hardening, R1-2 "Aave API Rate Limiting" and R1-3
"Runtime Pinning + Production CI Smoke Gate")**: `middleware.ts` now
exists at the repository root — the statement above that no
`middleware.ts` existed anywhere in the repository is no longer
accurate and is corrected here rather than left stale. It is a narrow,
framework-glue file applying a rate-limit boundary to `/api/aave/*`
only (§7 below); it does not add a platform-specific deployment
requirement — the application remains portable to any Next.js-capable
host, since `middleware.ts` is a standard Next.js primitive, not a
vendor-specific configuration file. `package.json` also now declares
`engines` (`node: >=22.0.0 <23.0.0`, `pnpm: >=10.0.0 <11.0.0`) and a
committed `.nvmrc` (`22`), making the supported runtime machine-checkable
rather than only prose in `04_BUILD_GUIDE.md`; `pnpm install`/CI reject
an unsupported Node/pnpm version rather than silently proceeding.
**Status: Verified — portable, no vendor lock-in, matches Build Guide
through the build step; runtime requirements are now machine-enforced.**

## 7. Application-level API rate limiting (added post-M10, R1-2/R1-3)

Not part of M10-005's original Review list (which predates this work) —
recorded here because it is production-readiness-relevant repository
evidence, and because §6 above now references it.

The three public `/api/aave/*` routes (`reserve`, `v4-position`,
`v4-collateral-risk`) — the only routes that proxy requests into RPC
infrastructure — are covered by `middleware.ts` plus the framework-free
`services/rateLimit/` policy/limiter (`FixedWindowRateLimiter`,
30 requests per client identity per 60-second window). Client identity
is resolved from `x-forwarded-for` (first entry) or `x-real-ip`, falling
back to a single shared `'unknown'` bucket when neither header is
present. A request over the limit receives `429` with a machine-readable
JSON error body and a `Retry-After` header; no internal detail or secret
is ever exposed in that response.

**Honest limitation, stated plainly**: this is a **process-local,
in-memory** limiter — it is not a substitute for infrastructure-level or
distributed rate limiting. In a multi-instance/serverless deployment
(multiple concurrent server processes, each with its own memory), the
effective limit is per-instance, not globally coordinated across the
fleet — a real deployment fronted by a CDN/WAF/API gateway should still
apply its own coordinated throttling for defense in depth; this
repository-level control does not claim to replace that. The same
`'unknown'`-identity fallback also means that in an environment with no
reverse proxy forwarding real client IPs (e.g., local `pnpm build && pnpm
start`, or this project's own local/CI E2E runs), all traffic through
`/api/aave/*` shares one bucket — a known, documented interaction (see
R2-4's E2E findings below), not a defect.

A small, blocking production smoke gate (R1-3, `tests/e2e/productionSmoke.spec.ts`)
runs in `.github/workflows/ci.yml` against a real `pnpm build && pnpm
start` server on every PR/push, proving the built production application
actually starts and serves its critical routes — narrower than the full
Playwright suite by design (see `docs/KNOWN_ISSUES.md` category C and
`docs/DEFECT_CLASSIFICATION.md` §6 for how the full suite is run
instead). **Status: Verified — repository-level control, not a
substitute for infrastructure-level throttling; limitation documented,
not glossed over.**

## Summary

| Component | Status |
|---|---|
| Environment variables | Verified |
| Supabase configuration (code path) | Verified (graceful degradation confirmed) |
| Supabase configuration (a real project) | Deferred by explicit product/release decision |
| Deployment secrets | Deferred by explicit product/release decision |
| Security headers | Verified, matches Build Guide |
| Caching | Verified — no gap found |
| Build configuration | Verified — portable, no vendor lock-in; runtime requirements now machine-enforced |
| Application-level API rate limiting (R1-2/R1-3) | Verified — repository-level control; not a substitute for infrastructure-level/distributed throttling |

Everything this repository controls is production-ready. The remaining
gap between "production-ready" and "in production" is entirely external
infrastructure this release deliberately does not include — see
`docs/RELEASE_NOTES.md`. See `docs/DEPLOYMENT_DISPOSITION.md`
(Milestone 10 Batch 6) for the full M10-006–M10-011 requirement-by-
requirement disposition that follows from this readiness state, and
`docs/CHANGELOG.md`'s "Post-M10 hardening (R1/R2)" entry for the full
list of hardening work completed after Milestone 10's own closure. **No
real production deployment has been operated as a result of this
update, and no production-traffic evidence exists** — every verification
above remains local production-*mode* evidence, not production-
*deployment* evidence, unchanged from the rest of this document.

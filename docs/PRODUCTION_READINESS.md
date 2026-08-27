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
`middleware.ts`, no platform-specific configuration file exists anywhere
in the repository (confirmed by direct inspection). This matches
`04_BUILD_GUIDE.md`'s own "avoid vendor lock-in whenever practical"
principle under "DEPLOYMENT PLATFORM": the build is portable to Vercel,
a Docker/self-hosted container, Cloudflare, or Netlify without any
platform-specific file to add or remove first. The Build Guide's own
"BUILD PROCESS" pipeline (Install → Type Check → Lint → Run Tests →
Production Build → Deploy → Health Check → Ready) matches this
repository's `pnpm validate` script and `.github/workflows/ci.yml`
exactly through "Production Build" — "Deploy" and "Health Check" are the
two steps requiring an actual deployment target, Deferred per the same
release decision as above. **Status: Verified — portable, no vendor
lock-in, matches Build Guide through the build step.**

## Summary

| Component | Status |
|---|---|
| Environment variables | Verified |
| Supabase configuration (code path) | Verified (graceful degradation confirmed) |
| Supabase configuration (a real project) | Deferred by explicit product/release decision |
| Deployment secrets | Deferred by explicit product/release decision |
| Security headers | Verified, matches Build Guide |
| Caching | Verified — no gap found |
| Build configuration | Verified — portable, no vendor lock-in |

Everything this repository controls is production-ready. The remaining
gap between "production-ready" and "in production" is entirely external
infrastructure this release deliberately does not include — see
`docs/RELEASE_NOTES.md`. See `docs/DEPLOYMENT_DISPOSITION.md`
(Milestone 10 Batch 6) for the full M10-006–M10-011 requirement-by-
requirement disposition that follows from this readiness state.

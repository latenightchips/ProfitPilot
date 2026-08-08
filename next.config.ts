import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

/**
 * Security headers — 06_TASKS.md M9-035 ("Review Security Headers and
 * Deployment Controls"). Review: "Content Security Policy where
 * practical, Frame restrictions, Content type protections, Referrer
 * policy, HTTPS enforcement, Secure cookies, Preview deployment access
 * where appropriate." DoD: "Production responses include approved
 * security protections without breaking required functionality."
 *
 * **Genuine gap, fixed here — confirmed empty before this batch**
 * (`docs/DOD_COMPLIANCE_AUDIT.md`'s own re-check, independently
 * re-confirmed at the start of this batch: no `headers()` function, no
 * `middleware.ts` anywhere in this repository).
 *
 * **`connect-src` is built from this app's own two optional,
 * dynamically-configured external origins** (`NEXT_PUBLIC_SUPABASE_URL`,
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY`'s sibling `NEXT_PUBLIC_PRICE_API_URL`
 * — see `utils/env.ts`'s own header comment for why both are
 * `NEXT_PUBLIC_`-prefixed) rather than a hardcoded guess at a specific
 * provider's domain. Both are read directly from `process.env` here,
 * not from `utils/env.ts`'s own validated `env` export — this file runs
 * outside the Next.js request/render lifecycle `env.ts`'s module-load-
 * time `loadEnv()` assumes, and a CSP header only needs the raw origin
 * string, not the full validated shape. In this environment, both are
 * unset, so `connect-src` resolves to `'self'` alone — an accurate
 * reflection of this build actually making zero outbound runtime
 * requests today (no `PriceProvider`/CoinGecko adapter exists yet,
 * confirmed by `features/dashboard/components/DashboardSummaryHeader.tsx`'s
 * own header comment; Supabase Auth is real but dormant/unconfigured).
 * A future deployment that sets either variable gets that origin added
 * automatically, without this file needing to change.
 *
 * **`script-src`/`style-src` include `'unsafe-inline'`, not a stricter
 * nonce-based policy.** Next.js's own App Router injects inline
 * bootstrap/hydration scripts and Tailwind's runtime can emit inline
 * `<style>` tags; a nonce-based CSP is achievable but requires
 * `middleware.ts` to mint and thread a per-request nonce through
 * `next/headers`, a materially larger change than this batch's own
 * "without breaking required functionality" DoD allows for casually.
 * `'unsafe-inline'` is the same practical tradeoff Next.js's own CSP
 * documentation describes as the default starting point; still real
 * defense against a *reflected* injection from an external, non-inline
 * source, which `default-src 'self'` and `object-src 'none'` close off.
 *
 * **HTTPS enforcement**: `Strict-Transport-Security` below is the
 * client-reinforcement half; the actual HTTP→HTTPS redirect is
 * delegated to hosting/deployment configuration, the same framing
 * `docs/SECURITY_REVIEW.md`'s own "HTTPS only" checklist row already
 * established — this application has no server runtime of its own to
 * add a redirect to (static/edge-rendered Next.js output).
 *
 * **HSTS carries `max-age=63072000; includeSubDomains` but deliberately
 * NOT `preload`.** `max-age`/`includeSubDomains` are safe, reversible
 * defaults appropriate for any HTTPS-served deployment of this
 * self-hostable, local-first application. `preload` is not: submitting a
 * domain to the browser-vendor-maintained HSTS preload list is a
 * separate, largely irreversible action (removal can take months even
 * after requesting it) that this codebase has no business presuming on
 * behalf of every future deployer — this application has no single,
 * confirmed production domain of its own, and a deployer running it on
 * an internal/staging subdomain that isn't fully HTTPS-ready could be
 * broken by an inherited `preload` directive they never asked for.
 * Adding `preload` is a deliberate, per-deployment decision left to
 * whoever actually owns the domain, documented here rather than defaulted.
 *

 * **Secure cookies**: not applicable — no header sets a cookie here,
 * because this application's own code never sets one.
 * `@supabase/supabase-js`'s `GoTrueClient` persists its session to
 * `localStorage`, not a cookie (`services/auth/supabaseClient.ts`'s own
 * header comment) — there is no cookie for this application's own
 * response headers to mark `Secure`/`HttpOnly`/`SameSite`.
 *
 * **Preview deployment access**: a hosting-platform concern (e.g. a
 * password-protected preview URL), not something `next.config.ts` can
 * express — recorded as a deployment recommendation in
 * `docs/SECURITY_REVIEW.md` rather than a code change here.
 *
 * **`connect-src` also allows `NEXT_PUBLIC_SENTRY_DSN`'s own origin
 * (Milestone 9 Batch 9, M9-049)** — a Sentry DSN is itself a valid URL
 * (`https://<key>@<host>/<project>`), so `new URL(dsn).origin` extracts
 * the real ingestion host the same way the other two origins are
 * extracted below. Without this, a configured Sentry DSN would silently
 * fail to report anything in production — the CSP `default-src 'self'`
 * would block the SDK's own `fetch` call, the opposite of what a
 * security header should do to error-monitoring infrastructure. In this
 * environment the variable is unset, so this resolves to `'self'` alone,
 * same as before this batch.
 */
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PRICE_API_ORIGIN = process.env.NEXT_PUBLIC_PRICE_API_URL;
const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

function connectSrc(): string {
  const origins = new Set(["'self'"]);
  for (const raw of [SUPABASE_ORIGIN, PRICE_API_ORIGIN, SENTRY_DSN]) {
    if (raw === undefined || raw === '') continue;
    try {
      origins.add(new URL(raw).origin);
    } catch {
      // An invalid URL here is `utils/env.ts`'s own concern to reject at
      // startup (its Zod schema already requires a well-formed URL);
      // this header build must not throw over it either way.
    }
  }
  return [...origins].join(' ');
}

function contentSecurityPolicy(): string {
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src ${connectSrc()}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy() },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

/**
 * `withSentryConfig` wrapping — 06_TASKS.md M9-049. **Source-map upload
 * and release-tracking telemetry are explicitly disabled** (`sourcemaps:
 * { disable: true }`, `telemetry: false`, `silent: true`) — the same
 * "no live account, this build must never attempt to reach a real
 * backend" constraint `services/auth/supabaseClient.ts` already
 * documents for Supabase, applied here to Sentry's own *build-time*
 * plugin (distinct from the *runtime* SDK `services/observability/errorMonitoring.ts`
 * gates on `NEXT_PUBLIC_SENTRY_DSN`) — without this, `pnpm build` could
 * attempt an authenticated call to Sentry's own API (source map upload,
 * release creation) that has no credential in this environment and no
 * business running in a sandbox with no live project. Confirmed via a
 * real `pnpm build` that this wrapping introduces no network call and no
 * build failure. `org`/`project`/`authToken` are deliberately left unset
 * for the identical reason — there is nothing to authenticate against
 * here, and this application has no CI-configured secret for them.
 */
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  sourcemaps: { disable: true },
});

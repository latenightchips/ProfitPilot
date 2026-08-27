import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Security headers — 06_TASKS.md M9-035 ("Review Security Headers and
 * Deployment Controls") — see `next.config.ts`'s own header comment for
 * the full reasoning. `vi.resetModules()` + a fresh dynamic `import()`
 * per test is required because `SUPABASE_ORIGIN`/`PRICE_API_ORIGIN` are
 * read from `process.env` at module load time, not inside `headers()`
 * itself — the same pattern `tests/unit/env.test.ts` already establishes
 * for `utils/env.ts`.
 */
describe('next.config.ts — security headers (M9-035)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets one header rule applying to every route', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.source).toBe('/(.*)');
  });

  it('includes Content-Security-Policy, frame, content-type, referrer, and HSTS headers', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const headerNames = rules?.[0]?.headers.map((header) => header.key) ?? [];
    expect(headerNames).toEqual(
      expect.arrayContaining([
        'Content-Security-Policy',
        'X-Frame-Options',
        'X-Content-Type-Options',
        'Referrer-Policy',
        'Strict-Transport-Security',
      ]),
    );
  });

  it('denies framing entirely and refuses MIME-sniffing', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const headers = rules?.[0]?.headers ?? [];
    expect(headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
    expect(headers.find((h) => h.key === 'X-Content-Type-Options')?.value).toBe('nosniff');
  });

  it("scopes the CSP's connect-src to 'self' alone when no external origin is configured", async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const csp = rules?.[0]?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('supabase');
  });

  it("adds a configured Supabase origin to connect-src, without breaking 'self'", async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const csp = rules?.[0]?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("connect-src 'self' https://example.supabase.co");
  });

  it("adds a configured Sentry DSN's own origin to connect-src (M9-049), without breaking 'self'", async () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://examplekey@o0.ingest.sentry.io/1');
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const csp = rules?.[0]?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("connect-src 'self' https://o0.ingest.sentry.io");
  });

  it('does not throw when an env-configured URL is malformed — utils/env.ts is responsible for rejecting that at startup, not this file', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url');
    await expect(import('../../next.config')).resolves.toBeDefined();
  });

  it("restricts framing (frame-ancestors 'none') and object embeds (object-src 'none') in the CSP itself, not only via X-Frame-Options", async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const csp = rules?.[0]?.headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});

/**
 * `Permissions-Policy` — R2-3 ("Add Minimal Permissions-Policy Browser
 * Hardening"). See `next.config.ts`'s own header comment for the full
 * audit this deny-list is based on (a repository-wide search confirming
 * zero use of any of these eight capabilities) and why `clipboard-*`/
 * `fullscreen` are deliberately left out.
 */
describe('next.config.ts — Permissions-Policy (R2-3)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('is present on the same single rule every other production route header already applies to', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    expect(rules).toHaveLength(1);
    expect(rules?.[0]?.source).toBe('/(.*)');
    const headerNames = rules?.[0]?.headers.map((header) => header.key) ?? [];
    expect(headerNames).toContain('Permissions-Policy');
  });

  it('denies exactly the eight audited-unused capabilities, each with an empty allowlist', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const value = rules?.[0]?.headers.find((h) => h.key === 'Permissions-Policy')?.value;

    expect(value).toBe(
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
    );
  });

  it('does not disable clipboard or fullscreen — capabilities this app has no programmatic-access usage of, but a manual browser action is unaffected by either way', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const value = rules?.[0]?.headers.find((h) => h.key === 'Permissions-Policy')?.value ?? '';

    expect(value).not.toContain('clipboard');
    expect(value).not.toContain('fullscreen');
  });

  it('leaves every pre-existing security header unchanged by its addition', async () => {
    const { default: nextConfig } = await import('../../next.config');
    const rules = await nextConfig.headers?.();
    const headers = rules?.[0]?.headers ?? [];

    expect(headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
    expect(headers.find((h) => h.key === 'X-Content-Type-Options')?.value).toBe('nosniff');
    expect(headers.find((h) => h.key === 'Referrer-Policy')?.value).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(headers.find((h) => h.key === 'Strict-Transport-Security')?.value).toBe(
      'max-age=63072000; includeSubDomains',
    );
    const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
  });

  it('is syntactically stable and deterministic — identical across repeated calls, independent of any env configuration', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    const { default: nextConfig } = await import('../../next.config');

    const first = (await nextConfig.headers?.())?.[0]?.headers.find(
      (h) => h.key === 'Permissions-Policy',
    )?.value;
    const second = (await nextConfig.headers?.())?.[0]?.headers.find(
      (h) => h.key === 'Permissions-Policy',
    )?.value;

    expect(first).toBe(second);
    // Unlike connect-src, Permissions-Policy is a fixed, static list —
    // configuring an otherwise-relevant env var must not perturb it.
    expect(first).not.toContain('supabase');
  });
});

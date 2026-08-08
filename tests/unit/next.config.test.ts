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

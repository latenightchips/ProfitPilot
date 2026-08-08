import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('env', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('falls back to documented defaults when nothing is configured', async () => {
    const { env } = await import('@/utils/env');
    expect(env.NEXT_PUBLIC_APP_NAME).toBe('ProfitPilot');
    expect(env.NEXT_PUBLIC_DEFAULT_CURRENCY).toBe('USD');
  });

  it('accepts a fully unconfigured Manual Mode environment', async () => {
    await expect(import('@/utils/env')).resolves.toBeDefined();
  });

  it('rejects a malformed URL value', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'not-a-url');
    await expect(import('@/utils/env')).rejects.toThrow(/Invalid environment configuration/);
  });

  /**
   * 06_TASKS.md M9-030 ("Audit Environment Variable Handling") — a
   * genuine defect found and fixed this batch: the un-prefixed
   * `SUPABASE_URL`/`SUPABASE_ANON_KEY` this schema originally declared
   * are never inlined into the client bundle by Next.js, silently
   * defeating the dormant Auth capability even once "configured" by a
   * deployer. This test locks in the corrected, `NEXT_PUBLIC_`-prefixed
   * names — see `utils/env.ts`'s own header comment for the full
   * reasoning.
   */
  it('reads the Supabase URL/anon key only from their NEXT_PUBLIC_-prefixed names', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
    const { env } = await import('@/utils/env');
    expect(env.NEXT_PUBLIC_SUPABASE_URL).toBe('https://example.supabase.co');
    expect(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBe('test-anon-key');
  });
});

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
    vi.stubEnv('SUPABASE_URL', 'not-a-url');
    await expect(import('@/utils/env')).rejects.toThrow(/Invalid environment configuration/);
  });
});

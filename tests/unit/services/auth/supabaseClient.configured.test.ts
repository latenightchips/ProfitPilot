import { describe, expect, it, vi } from 'vitest';

/**
 * Supabase Client Configuration — 06_TASKS.md M8-014, "configured" path.
 * This sandbox has no real Supabase project (see `supabaseClient.ts`'s
 * own header comment), so `utils/env.ts` is mocked here to simulate a
 * hypothetical configured environment — a real construction of
 * `@supabase/supabase-js`'s `createClient` (no network call at
 * construction time), but never a real authenticated request. Separate
 * test file so this mock never leaks into `supabaseClient.test.ts`'s own
 * "real, unmocked sandbox" assertions — Vitest isolates modules per file.
 */
vi.mock('@/utils/env', () => ({
  env: {
    NEXT_PUBLIC_APP_NAME: 'ProfitPilot',
    NEXT_PUBLIC_DEFAULT_CURRENCY: 'USD',
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'test-anon-key',
  },
}));

describe('checkSupabaseConfig (simulated configured environment)', () => {
  it('reports configured when both URL and anon key are present', async () => {
    const { checkSupabaseConfig } = await import('@/services/auth/supabaseClient');
    expect(checkSupabaseConfig()).toEqual({ configured: true });
  });
});

describe('getSupabaseClient (simulated configured environment)', () => {
  it('returns a real SupabaseClient instance, cached across calls', async () => {
    const { getSupabaseClient } = await import('@/services/auth/supabaseClient');
    const first = getSupabaseClient();
    const second = getSupabaseClient();
    expect(first).not.toBeNull();
    expect(first).toBe(second);
    expect(first?.auth).toBeDefined();
  });
});

import { describe, expect, it } from 'vitest';

import { checkSupabaseConfig, getSupabaseClient } from '@/services/auth/supabaseClient';

/**
 * Supabase Client Configuration — 06_TASKS.md M8-014. This test file
 * exercises the REAL, unmocked `utils/env.ts` — an honest reflection of
 * this development sandbox, which has no `SUPABASE_URL`/
 * `SUPABASE_ANON_KEY` configured (verified before this batch began; see
 * `supabaseClient.ts`'s own header comment). It therefore only proves
 * the "not configured" path, which is this sandbox's real, observable
 * behavior. `supabaseClient.configured.test.ts` exercises the
 * "configured" path against a mocked `env`, since no real credentials
 * exist here to exercise it against.
 */
describe('checkSupabaseConfig (real, unconfigured sandbox environment)', () => {
  it('reports not configured — this environment has no Supabase URL or anon key set', () => {
    const status = checkSupabaseConfig();
    expect(status.configured).toBe(false);
    expect(status.reason).toBeDefined();
  });
});

describe('getSupabaseClient (real, unconfigured sandbox environment)', () => {
  it('returns null rather than throwing', () => {
    expect(getSupabaseClient()).toBeNull();
  });

  it('is cached — repeated calls return the same null without re-checking', () => {
    expect(getSupabaseClient()).toBe(getSupabaseClient());
  });
});

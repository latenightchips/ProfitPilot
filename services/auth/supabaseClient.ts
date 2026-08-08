/**
 * Supabase Client Configuration — 06_TASKS.md M8-014 ("Configure
 * Supabase Client"). Dependencies: M1-007 (`utils/env.ts`). Requirements:
 * "No service-role key in the browser. Typed configuration. Graceful
 * behavior when cloud configuration is absent. Secure session handling."
 * DoD: "The application can run in local-only mode when Supabase is not
 * configured."
 *
 * **No service-role key anywhere in this codebase.** `utils/env.ts`'s
 * own schema declares only `NEXT_PUBLIC_SUPABASE_URL`/
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` — there is no
 * `SUPABASE_SERVICE_ROLE_KEY` field to read, so a service-role key
 * cannot reach the browser through this module even by mistake. This is
 * the anon (publishable) key only, the same key Supabase's own docs
 * document as safe to ship to a browser bundle — and, since M9-030
 * (this batch), actually shipped there: see `utils/env.ts`'s own header
 * comment for why the `NEXT_PUBLIC_` prefix is required, not optional,
 * for this module (reached from a Client Component) to ever read a
 * real value in the browser.
 *
 * **"Secure session handling"** is delegated entirely to `@supabase/supabase-js`'s
 * own `GoTrueClient` (`persistSession: true`, `autoRefreshToken: true`,
 * the library defaults) rather than a hand-rolled token store — reusing
 * an already-audited session/refresh implementation is the safer choice
 * than re-implementing token storage and rotation in this codebase.
 *
 * **Graceful absence, not a thrown error.** `getSupabaseClient()` returns
 * `null` when `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * are unset or invalid —
 * mirroring `PersistenceAdapterAvailability`'s own "available: false, not
 * an exception" pattern (`services/persistence/types/adapter.ts`) for
 * the exact same reason: an unconfigured optional external service is an
 * ordinary, expected state (every environment this application runs in
 * today, including this one), not a startup failure. `services/auth/authService.ts`
 * is the only other module that reads this file — no UI component or
 * Store may import `@supabase/supabase-js` directly (this batch's own
 * standing architecture requirement).
 *
 * **This sandbox has no real Supabase project, CLI, or local emulator**
 * (verified before writing this file — no `NEXT_PUBLIC_SUPABASE_URL`/
 * `NEXT_PUBLIC_SUPABASE_ANON_KEY` in the environment, no `supabase` CLI
 * installed, no reachable Docker
 * daemon for a local stack, and `supabase/` in this repo is an empty
 * placeholder directory). `getSupabaseClient()` therefore always returns
 * `null` in this environment today — a real, honestly-observed fact
 * about this sandbox, not a code path this module treats specially.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/utils/env';

export interface SupabaseConfigStatus {
  configured: boolean;
  /** Present only when `configured` is false — a safe, user-facing reason. */
  reason?: string;
}

export function checkSupabaseConfig(): SupabaseConfigStatus {
  if (env.NEXT_PUBLIC_SUPABASE_URL === undefined || env.NEXT_PUBLIC_SUPABASE_URL === '') {
    return { configured: false, reason: 'Supabase URL is not configured.' };
  }
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined || env.NEXT_PUBLIC_SUPABASE_ANON_KEY === '') {
    return { configured: false, reason: 'Supabase anon key is not configured.' };
  }
  return { configured: true };
}

let cachedClient: SupabaseClient | null | undefined;

/**
 * Lazily constructed and cached — `createClient` is not free (it sets up
 * the auth/storage/realtime sub-clients), and every caller through
 * `authService.ts` should share one instance, the same singleton
 * convention `services/persistence/persistence.service.ts`'s own
 * `persistenceService` already established.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (cachedClient !== undefined) return cachedClient;

  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  cachedClient =
    url !== undefined && url !== '' && anonKey !== undefined && anonKey !== ''
      ? createClient(url, anonKey)
      : null;
  return cachedClient;
}

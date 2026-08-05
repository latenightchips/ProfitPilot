/**
 * Authentication Service types — 06_TASKS.md M8-015 ("Implement
 * Authentication Service"). Support list, verbatim: "Sign up with email
 * and password, Sign in, Sign out, Session refresh, Password reset
 * request, Authentication state, Authentication errors."
 *
 * `AuthUser`/`AuthSession` are this application's own minimal shapes —
 * not a re-export of `@supabase/supabase-js`'s `User`/`Session` types.
 * Only `AuthClient` (`./supabaseClient.ts`) and `authService.ts` itself
 * ever import from `@supabase/supabase-js`; every other layer (`authStore`,
 * every UI component) sees only these application-owned types, the same
 * "Services stay generic, never leak a third-party SDK type upward"
 * discipline `services/persistence/types/models.ts`'s own header comment
 * already established for Supabase-adjacent code.
 */
export interface AuthUser {
  id: string;
  email: string | null;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds, or `null` when the provider didn't report one. */
  expiresAt: number | null;
  user: AuthUser;
}

export interface AuthAvailability {
  available: boolean;
  /** Present only when `available` is false — a safe, user-facing reason. */
  reason?: string;
}

/**
 * Forwarded from `@supabase/supabase-js`'s own `AuthChangeEvent` as an
 * opaque string rather than re-declaring its full enum — `authStore.ts`
 * only ever branches on `'SIGNED_OUT'` (to clear local auth state) and
 * treats every other event as "refresh the session from the payload,"
 * so a full enum re-specification would be unused surface, the same
 * "loose but real" scope `services/persistence/schemas/shared.schema.ts`'s
 * `looseRecordSchema` already documents for a different, equally
 * SDK-shaped case.
 */
export type AuthChangeEvent = string;

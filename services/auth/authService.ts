/**
 * Authentication Service — 06_TASKS.md M8-015 ("Implement Authentication
 * Service"). Support: "Sign up with email and password, Sign in, Sign
 * out, Session refresh, Password reset request, Authentication state,
 * Authentication errors." DoD: "UI components do not call Supabase
 * authentication APIs directly."
 *
 * **`createAuthService(client)` — a factory over a narrow, structural
 * `AuthClient` interface, not the real `SupabaseClient['auth']`
 * (`GoTrueClient`) type.** The same dependency-injection convention
 * `createPersistenceService(adapter)` already established: production
 * code passes the real thing (`getSupabaseClient()?.auth`), tests pass a
 * small in-memory fake — see `AuthClient`'s own comment for why a real
 * `GoTrueClient` satisfies it without a cast. `authService` (the shared
 * singleton below) is what `authStore.ts` and every UI flow actually
 * imports; `createAuthService` itself stays exported for tests, same
 * split as `createPersistenceService`/`persistenceService`.
 *
 * **Every method returns `MappingResult<T>`, never throws, and never
 * touches `@supabase/supabase-js` types beyond this file and
 * `./supabaseClient.ts`.** Errors are translated to this application's
 * own `ApplicationError` (`category: 'authentication'`) via
 * `toApplicationError` — `AuthError.message` is Supabase's own
 * already-user-facing copy (e.g. "Invalid login credentials"), not a
 * raw exception or stack trace, so passing it through matches this
 * codebase's own "safe, user-facing `message`" discipline
 * (`services/shared/errors.ts`'s own header comment) without needing a
 * second translation table this batch has no real error catalog to
 * build from.
 *
 * **No live Supabase project exists in this development environment**
 * (see `./supabaseClient.ts`'s own header comment for what was actually
 * checked). Every method below is exercised in this batch's own tests
 * against a fake `AuthClient`, never a real backend — see this batch's
 * final summary for the exact scope of what "tested" means here.
 *
 * **`callAuthClient` — R2-2 ("Harden Supabase/Auth Calls Against
 * Unexpected Rejections").** `tests/unit/services/auth/authService.test.ts`'s
 * own M9-047 test already confirmed, by direct inspection of the
 * installed `@supabase/supabase-js` package, that `GoTrueClient` wraps a
 * network-layer failure into a *resolved* `{error}` result rather than
 * rejecting — so under that specific, already-verified failure mode
 * there is genuinely nothing for a `try/catch` to catch. This is
 * broader, deliberate defense-in-depth on top of that, not a
 * contradiction of it: a future SDK version, an unanticipated runtime
 * exception inside `GoTrueClient` itself, or any other class of failure
 * this file cannot enumerate in advance could still reject the returned
 * Promise, and every method below's own header comment already *claims*
 * "never throws" as an established guarantee — this closes the actual
 * gap between that claim and the code that previously did not enforce
 * it. Every one of the seven async methods below now funnels its own
 * `client.<method>(...)` call through this one helper rather than each
 * writing its own `try/catch`: the interpretation of a *resolved*
 * `{data, error}` result stays fully visible and unique to each method
 * (passed in as `onResult`, never hidden inside this helper), only the
 * catch-and-report behavior for a genuine rejection is shared.
 *
 * **Diagnostic path: both `captureError` and `logDiagnosticEvent`** —
 * the identical choice `app/api/aave/_shared/unexpectedErrorBoundary.ts`
 * already made for the equivalent Aave-route boundary (R2-1), for the
 * same reason: `captureError`'s `captureException` preserves the real
 * exception/stack for a live Sentry project, but is a silent no-op
 * without one configured (this application's actual common case);
 * `logDiagnosticEvent` always writes to the console regardless, so an
 * operator has something to look at either way. Neither ever receives
 * anything beyond the four short `feature`/`operation`/`code` tags
 * already used throughout this file — no email, password, token, or
 * session content ever reaches either call.
 *
 * **Never reflects the caught exception's own message/stack to the
 * caller.** The `MappingResult` failure `callAuthClient` returns on a
 * catch always carries the same static, generic
 * `'An unexpected error occurred. Please try again.'` — the one place
 * this file already deviates from "pass Supabase's own message
 * through" (every *resolved* `{error}` case still does exactly that,
 * unchanged), because an exception's message here is an unclassified
 * JS/runtime string, not Supabase's own already-safe, user-facing copy.
 */
import { buildDiagnosticEvent, captureError, logDiagnosticEvent } from '@/services/observability';
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared';

import { getSupabaseClient } from './supabaseClient';
import type { AuthAvailability, AuthChangeEvent, AuthSession, AuthUser } from './types';

/** The subset of Supabase's own `User` shape this Service actually reads. */
export interface SupabaseAuthUser {
  id: string;
  email?: string;
}

/** The subset of Supabase's own `Session` shape this Service actually reads. */
export interface SupabaseAuthSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  user: SupabaseAuthUser;
}

/** The subset of Supabase's own `AuthError` shape this Service actually reads. */
export interface SupabaseAuthErrorLike {
  message: string;
  code?: string;
  status?: number;
}

interface SupabaseAuthResult {
  data: { user: SupabaseAuthUser | null; session: SupabaseAuthSession | null };
  error: SupabaseAuthErrorLike | null;
}

/**
 * The narrow surface this Service actually calls off
 * `SupabaseClient['auth']` (a real `GoTrueClient`). A real `GoTrueClient`
 * satisfies this structurally — every method below is one it already
 * implements with a compatible-or-wider signature — so
 * `getSupabaseClient()?.auth` can be passed to `createAuthService`
 * without a cast, and a small hand-written fake can satisfy it in tests
 * without implementing `GoTrueClient`'s entire real surface.
 */
export interface AuthClient {
  signUp(credentials: { email: string; password: string }): Promise<SupabaseAuthResult>;
  signInWithPassword(credentials: { email: string; password: string }): Promise<SupabaseAuthResult>;
  signOut(options?: { scope?: 'global' | 'local' | 'others' }): Promise<{
    error: SupabaseAuthErrorLike | null;
  }>;
  resetPasswordForEmail(
    email: string,
    options?: { redirectTo?: string },
  ): Promise<{ error: SupabaseAuthErrorLike | null }>;
  getSession(): Promise<{
    data: { session: SupabaseAuthSession | null };
    error: SupabaseAuthErrorLike | null;
  }>;
  refreshSession(): Promise<SupabaseAuthResult>;
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: SupabaseAuthSession | null) => void,
  ): { data: { subscription: { unsubscribe: () => void } } };
  /** Completes M8-019's password-reset flow — requires the temporary session the recovery link established. */
  updateUser(attributes: { password: string }): Promise<{
    data: { user: SupabaseAuthUser | null };
    error: SupabaseAuthErrorLike | null;
  }>;
}

function toAuthUser(user: SupabaseAuthUser): AuthUser {
  return { id: user.id, email: user.email ?? null };
}

function toAuthSession(session: SupabaseAuthSession): AuthSession {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at ?? null,
    user: toAuthUser(session.user),
  };
}

function toApplicationError(error: SupabaseAuthErrorLike) {
  return createApplicationError('authentication', error.code ?? 'AUTH_ERROR', error.message);
}

function notConfiguredFailure(): MappingResult<never> {
  return {
    ok: false,
    errors: [
      createApplicationError(
        'authentication',
        'SUPABASE_NOT_CONFIGURED',
        'Cloud accounts are not available in this environment.',
      ),
    ],
  };
}

const UNEXPECTED_AUTH_ERROR_CODE = 'AUTH_UNEXPECTED_ERROR';

function unexpectedAuthFailure(): MappingResult<never> {
  return {
    ok: false,
    errors: [
      createApplicationError(
        'authentication',
        UNEXPECTED_AUTH_ERROR_CODE,
        'An unexpected error occurred. Please try again.',
      ),
    ],
  };
}

/**
 * Calls `client`, interprets its *resolved* result via `onResult`, and
 * converts a genuine thrown/rejected exception into the same safe
 * `MappingResult` failure shape every other failure path in this file
 * already returns — see this file's own header comment for the full
 * reasoning.
 */
async function callAuthClient<TResult, TData>(
  operation: string,
  call: () => Promise<TResult>,
  onResult: (result: TResult) => MappingResult<TData>,
): Promise<MappingResult<TData>> {
  let result: TResult;
  try {
    result = await call();
  } catch (error) {
    captureError(error, { feature: 'auth', operation, code: UNEXPECTED_AUTH_ERROR_CODE });
    logDiagnosticEvent(
      buildDiagnosticEvent({
        category: 'authentication',
        code: UNEXPECTED_AUTH_ERROR_CODE,
        feature: 'auth',
        operation,
        outcome: 'failure',
      }),
    );
    return unexpectedAuthFailure();
  }
  return onResult(result);
}

export function createAuthService(client: AuthClient | null) {
  return {
    checkAvailability(): AuthAvailability {
      return client === null
        ? { available: false, reason: 'Supabase is not configured for this environment.' }
        : { available: true };
    },

    async signUp(email: string, password: string): Promise<MappingResult<AuthSession | null>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'signUp',
        () => client.signUp({ email, password }),
        (result) => {
          if (result.error !== null)
            return { ok: false, errors: [toApplicationError(result.error)] };
          // `session` is null when the project requires email confirmation
          // before a session is issued — a real, expected outcome, not a
          // failure.
          return {
            ok: true,
            data: result.data.session === null ? null : toAuthSession(result.data.session),
          };
        },
      );
    },

    async signIn(email: string, password: string): Promise<MappingResult<AuthSession>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'signIn',
        () => client.signInWithPassword({ email, password }),
        (result) => {
          if (result.error !== null) {
            return { ok: false, errors: [toApplicationError(result.error)] };
          }
          if (result.data.session === null) {
            return {
              ok: false,
              errors: [
                createApplicationError(
                  'authentication',
                  'NO_SESSION_RETURNED',
                  'Sign-in did not return a session.',
                ),
              ],
            };
          }
          return { ok: true, data: toAuthSession(result.data.session) };
        },
      );
    },

    async signOut(
      options: { scope?: 'global' | 'local' | 'others' } = {},
    ): Promise<MappingResult<void>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'signOut',
        () => client.signOut(options),
        (result) => {
          if (result.error !== null)
            return { ok: false, errors: [toApplicationError(result.error)] };
          return { ok: true, data: undefined };
        },
      );
    },

    async requestPasswordReset(email: string): Promise<MappingResult<void>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'requestPasswordReset',
        () => client.resetPasswordForEmail(email),
        (result) => {
          if (result.error !== null) {
            return { ok: false, errors: [toApplicationError(result.error)] };
          }
          return { ok: true, data: undefined };
        },
      );
    },

    /**
     * Completes M8-019's password-reset flow. Only meaningful when
     * called from the temporary session Supabase's own recovery-link
     * redirect establishes (`GoTrueClient.updateUser`'s own
     * requirement) — `app/reset-password/page.tsx` never calls this
     * before that session exists.
     */
    async completePasswordReset(newPassword: string): Promise<MappingResult<void>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'completePasswordReset',
        () => client.updateUser({ password: newPassword }),
        (result) => {
          if (result.error !== null) {
            return { ok: false, errors: [toApplicationError(result.error)] };
          }
          return { ok: true, data: undefined };
        },
      );
    },

    async getSession(): Promise<MappingResult<AuthSession | null>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'getSession',
        () => client.getSession(),
        (result) => {
          if (result.error !== null)
            return { ok: false, errors: [toApplicationError(result.error)] };
          return {
            ok: true,
            data: result.data.session === null ? null : toAuthSession(result.data.session),
          };
        },
      );
    },

    async refreshSession(): Promise<MappingResult<AuthSession | null>> {
      if (client === null) return notConfiguredFailure();
      return callAuthClient(
        'refreshSession',
        () => client.refreshSession(),
        (result) => {
          if (result.error !== null)
            return { ok: false, errors: [toApplicationError(result.error)] };
          return {
            ok: true,
            data: result.data.session === null ? null : toAuthSession(result.data.session),
          };
        },
      );
    },

    /**
     * Returns an unsubscribe function — `null` when Supabase is not
     * configured (nothing to subscribe to). Forwards the raw
     * `AuthChangeEvent` string alongside the session — `authStore.ts`'s
     * own subscription ignores it (session presence alone is enough to
     * derive its state), but `app/reset-password/page.tsx` needs it to
     * tell an ordinary sign-in apart from the temporary session a
     * password-recovery link establishes (`'PASSWORD_RECOVERY'`).
     */
    onAuthStateChange(
      callback: (session: AuthSession | null, event: AuthChangeEvent) => void,
    ): (() => void) | null {
      if (client === null) return null;
      const { data } = client.onAuthStateChange((event, session) => {
        callback(session === null ? null : toAuthSession(session), event);
      });
      return () => data.subscription.unsubscribe();
    },
  };
}

export const authService = createAuthService(getSupabaseClient()?.auth ?? null);

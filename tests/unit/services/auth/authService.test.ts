import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AuthClient,
  SupabaseAuthErrorLike,
  SupabaseAuthSession,
} from '@/services/auth/authService';
import { createAuthService } from '@/services/auth/authService';
import type { AuthChangeEvent, AuthSession } from '@/services/auth/types';

/** R2-2 — see this file's own "unexpected-rejection hardening" describe block below. */
const { captureError, logDiagnosticEvent } = vi.hoisted(() => ({
  captureError: vi.fn(),
  logDiagnosticEvent: vi.fn(),
}));
vi.mock('@/services/observability', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/observability')>();
  return { ...actual, captureError, logDiagnosticEvent };
});

beforeEach(() => {
  captureError.mockClear();
  logDiagnosticEvent.mockClear();
});

/**
 * Authentication Service — 06_TASKS.md M8-015. Every test here runs
 * against `FakeAuthClient`, an in-memory stand-in for
 * `SupabaseClient['auth']` — this sandbox has no real Supabase project
 * (see `services/auth/supabaseClient.ts`'s own header comment), so
 * nothing in this file is verified against a live backend. See this
 * batch's final summary for the exact scope of what "tested" means here.
 */
function session(overrides: Partial<SupabaseAuthSession> = {}): SupabaseAuthSession {
  return {
    access_token: 'access-token',
    refresh_token: 'refresh-token',
    expires_at: 1234567890,
    user: { id: 'user-1', email: 'user@example.com' },
    ...overrides,
  };
}

function authError(message = 'Simulated auth error.', code = 'SIMULATED'): SupabaseAuthErrorLike {
  return { message, code, status: 400 };
}

class FakeAuthClient implements AuthClient {
  signUpResult: { session: SupabaseAuthSession | null; error: SupabaseAuthErrorLike | null } = {
    session: session(),
    error: null,
  };
  signInResult: { session: SupabaseAuthSession | null; error: SupabaseAuthErrorLike | null } = {
    session: session(),
    error: null,
  };
  signOutError: SupabaseAuthErrorLike | null = null;
  resetError: SupabaseAuthErrorLike | null = null;
  getSessionResult: { session: SupabaseAuthSession | null; error: SupabaseAuthErrorLike | null } = {
    session: null,
    error: null,
  };
  refreshResult: { session: SupabaseAuthSession | null; error: SupabaseAuthErrorLike | null } = {
    session: session(),
    error: null,
  };
  updateUserError: SupabaseAuthErrorLike | null = null;
  listeners: ((event: AuthChangeEvent, session: SupabaseAuthSession | null) => void)[] = [];
  unsubscribeCalls = 0;
  /**
   * R2-2 — set to make the *next* call on this fake reject instead of
   * resolving, simulating a genuine transport/runtime exception rather
   * than an ordinary Supabase `{error}` result. Each test constructs its
   * own fresh `FakeAuthClient` and exercises exactly one operation, so a
   * single shared field is enough — no per-method flag needed.
   */
  rejectWith: Error | null = null;

  async signUp() {
    if (this.rejectWith) throw this.rejectWith;
    return {
      data: { user: this.signUpResult.session?.user ?? null, session: this.signUpResult.session },
      error: this.signUpResult.error,
    };
  }

  async signInWithPassword() {
    if (this.rejectWith) throw this.rejectWith;
    return {
      data: { user: this.signInResult.session?.user ?? null, session: this.signInResult.session },
      error: this.signInResult.error,
    };
  }

  async signOut() {
    if (this.rejectWith) throw this.rejectWith;
    return { error: this.signOutError };
  }

  async resetPasswordForEmail() {
    if (this.rejectWith) throw this.rejectWith;
    return { error: this.resetError };
  }

  async getSession() {
    if (this.rejectWith) throw this.rejectWith;
    return { data: { session: this.getSessionResult.session }, error: this.getSessionResult.error };
  }

  async refreshSession() {
    if (this.rejectWith) throw this.rejectWith;
    return {
      data: { user: this.refreshResult.session?.user ?? null, session: this.refreshResult.session },
      error: this.refreshResult.error,
    };
  }

  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: SupabaseAuthSession | null) => void,
  ) {
    this.listeners.push(callback);
    return { data: { subscription: { unsubscribe: () => (this.unsubscribeCalls += 1) } } };
  }

  async updateUser() {
    if (this.rejectWith) throw this.rejectWith;
    return { data: { user: session().user }, error: this.updateUserError };
  }

  emit(event: AuthChangeEvent, sessionValue: SupabaseAuthSession | null): void {
    for (const listener of this.listeners) listener(event, sessionValue);
  }
}

describe('createAuthService — Supabase not configured (client: null)', () => {
  const service = createAuthService(null);

  it('checkAvailability reports unavailable', () => {
    expect(service.checkAvailability()).toEqual({
      available: false,
      reason: 'Supabase is not configured for this environment.',
    });
  });

  it('every method fails with SUPABASE_NOT_CONFIGURED rather than throwing', async () => {
    const results = await Promise.all([
      service.signUp('a@example.com', 'password123'),
      service.signIn('a@example.com', 'password123'),
      service.signOut(),
      service.requestPasswordReset('a@example.com'),
      service.getSession(),
      service.refreshSession(),
      service.completePasswordReset('newpassword123'),
    ]);
    for (const result of results) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.errors[0]?.code).toBe('SUPABASE_NOT_CONFIGURED');
    }
  });

  it('onAuthStateChange returns null (nothing to subscribe to)', () => {
    expect(service.onAuthStateChange(() => {})).toBeNull();
  });
});

describe('createAuthService — configured (fake client)', () => {
  it('checkAvailability reports available', () => {
    const service = createAuthService(new FakeAuthClient());
    expect(service.checkAvailability()).toEqual({ available: true });
  });

  it('signUp returns a mapped AuthSession on success', async () => {
    const service = createAuthService(new FakeAuthClient());
    const result = await service.signUp('a@example.com', 'password123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: 1234567890,
      user: { id: 'user-1', email: 'user@example.com' },
    });
  });

  it('signUp returns null session when email confirmation is required', async () => {
    const fake = new FakeAuthClient();
    fake.signUpResult = { session: null, error: null };
    const service = createAuthService(fake);
    const result = await service.signUp('a@example.com', 'password123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('signUp propagates a Supabase error as an ApplicationError', async () => {
    const fake = new FakeAuthClient();
    fake.signUpResult = {
      session: null,
      error: authError('Email already registered.', 'user_already_exists'),
    };
    const service = createAuthService(fake);
    const result = await service.signUp('a@example.com', 'password123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toEqual({
      category: 'authentication',
      code: 'user_already_exists',
      message: 'Email already registered.',
    });
  });

  it('signIn returns a mapped AuthSession on success', async () => {
    const service = createAuthService(new FakeAuthClient());
    const result = await service.signIn('a@example.com', 'password123');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.user.email).toBe('user@example.com');
  });

  it('signIn fails when no session is returned', async () => {
    const fake = new FakeAuthClient();
    fake.signInResult = { session: null, error: null };
    const service = createAuthService(fake);
    const result = await service.signIn('a@example.com', 'password123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('NO_SESSION_RETURNED');
  });

  it('signIn propagates invalid-credentials errors', async () => {
    const fake = new FakeAuthClient();
    fake.signInResult = {
      session: null,
      error: authError('Invalid login credentials.', 'invalid_credentials'),
    };
    const service = createAuthService(fake);
    const result = await service.signIn('a@example.com', 'wrong-password');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.message).toBe('Invalid login credentials.');
  });

  it('signIn converts a network-interruption-shaped failure to a safe ApplicationError, not a thrown/unhandled rejection (M9-047)', async () => {
    // `@supabase/supabase-js@2.110.8`'s own `GoTrueClient` wraps a
    // network-layer failure (a `fetch` rejection, a timeout) in an
    // `AuthRetryableFetchError`/`AuthUnknownError` and *resolves* the
    // call with it in the `error` field — confirmed directly against the
    // installed package (`AuthRetryableFetchError`/`AuthUnknownError`
    // both exist in its bundled source) — it does not reject the
    // returned Promise. `authService.ts`'s own methods have no
    // try/catch around `client.<method>(...)` for the identical reason:
    // there is nothing for one to catch under this documented contract.
    // This test proves that contract holds through to a safe result
    // rather than assuming it.
    const fake = new FakeAuthClient();
    fake.signInResult = {
      session: null,
      error: { message: 'Failed to fetch.', code: 'AuthRetryableFetchError', status: 0 },
    };
    const service = createAuthService(fake);

    await expect(service.signIn('a@example.com', 'password')).resolves.toMatchObject({
      ok: false,
      errors: [{ category: 'authentication', code: 'AuthRetryableFetchError' }],
    });
  });

  it('requestPasswordReset converts a network-interruption-shaped failure to a safe ApplicationError (M9-047)', async () => {
    const fake = new FakeAuthClient();
    fake.resetError = { message: 'Network request failed.', code: 'AuthRetryableFetchError' };
    const service = createAuthService(fake);

    const result = await service.requestPasswordReset('a@example.com');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.category).toBe('authentication');
    expect(result.errors[0]?.code).toBe('AuthRetryableFetchError');
  });

  it('signOut succeeds and propagates failures', async () => {
    const fake = new FakeAuthClient();
    const service = createAuthService(fake);
    expect((await service.signOut()).ok).toBe(true);

    fake.signOutError = authError('Sign-out failed.');
    const failed = await service.signOut();
    expect(failed.ok).toBe(false);
  });

  it('requestPasswordReset succeeds and propagates failures', async () => {
    const fake = new FakeAuthClient();
    const service = createAuthService(fake);
    expect((await service.requestPasswordReset('a@example.com')).ok).toBe(true);

    fake.resetError = authError('Rate limited.');
    const failed = await service.requestPasswordReset('a@example.com');
    expect(failed.ok).toBe(false);
  });

  it('completePasswordReset succeeds and propagates failures', async () => {
    const fake = new FakeAuthClient();
    const service = createAuthService(fake);
    expect((await service.completePasswordReset('newpassword123')).ok).toBe(true);

    fake.updateUserError = authError('Session expired.');
    const failed = await service.completePasswordReset('newpassword123');
    expect(failed.ok).toBe(false);
  });

  it('getSession returns null when there is no session', async () => {
    const service = createAuthService(new FakeAuthClient());
    const result = await service.getSession();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data).toBeNull();
  });

  it('getSession returns the mapped session when one exists', async () => {
    const fake = new FakeAuthClient();
    fake.getSessionResult = { session: session(), error: null };
    const service = createAuthService(fake);
    const result = await service.getSession();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.user.id).toBe('user-1');
  });

  it('refreshSession returns a mapped session', async () => {
    const service = createAuthService(new FakeAuthClient());
    const result = await service.refreshSession();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data?.accessToken).toBe('access-token');
  });

  it('onAuthStateChange forwards a mapped session, unsubscribe calls through', () => {
    const fake = new FakeAuthClient();
    const service = createAuthService(fake);
    const received: (AuthSession | null)[] = [];
    const unsubscribe = service.onAuthStateChange((sess) => {
      received.push(sess);
    });
    expect(unsubscribe).not.toBeNull();

    fake.emit('SIGNED_IN', session());
    expect(received).toHaveLength(1);
    expect(received[0]?.user.id).toBe('user-1');

    unsubscribe?.();
    expect(fake.unsubscribeCalls).toBe(1);
  });
});

/**
 * Unexpected-rejection hardening — R2-2 ("Harden Supabase/Auth Calls
 * Against Unexpected Rejections"). Every method here shares
 * `authService.ts`'s own `callAuthClient` helper — these tests prove
 * each of the seven is actually wired to it, not just the helper's own
 * generic behavior once. `signIn`/`refreshSession` get the deepest
 * coverage (the task's own "at minimum" pair); the rest get one
 * representative rejection test each, since the shared implementation
 * makes a per-operation deep-dive redundant.
 */
describe('createAuthService — unexpected rejection hardening (R2-2)', () => {
  it('signIn converts a genuine thrown/rejected exception to a safe MappingResult failure, not an unhandled rejection', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('sensitive internal detail: connection refused at 10.0.0.5');
    const service = createAuthService(fake);

    await expect(service.signIn('a@example.com', 'password123')).resolves.toEqual({
      ok: false,
      errors: [
        {
          category: 'authentication',
          code: 'AUTH_UNEXPECTED_ERROR',
          message: expect.any(String),
        },
      ],
    });
  });

  it('signIn never leaks the thrown exception’s own message into the returned error', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('sensitive internal detail');
    const service = createAuthService(fake);

    const result = await service.signIn('a@example.com', 'password123');
    expect(JSON.stringify(result)).not.toContain('sensitive internal detail');
  });

  it('signIn reports the exception via captureError and logDiagnosticEvent, tagged for signIn', async () => {
    const fake = new FakeAuthClient();
    const thrown = new Error('boom');
    fake.rejectWith = thrown;
    const service = createAuthService(fake);

    await service.signIn('a@example.com', 'password123');

    expect(captureError).toHaveBeenCalledWith(
      thrown,
      expect.objectContaining({
        feature: 'auth',
        operation: 'signIn',
        code: 'AUTH_UNEXPECTED_ERROR',
      }),
    );
    expect(logDiagnosticEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        feature: 'auth',
        operation: 'signIn',
        code: 'AUTH_UNEXPECTED_ERROR',
        outcome: 'failure',
      }),
    );
  });

  it('signIn fires no diagnostics for an ordinary Supabase {error} result (only a genuine exception counts)', async () => {
    const fake = new FakeAuthClient();
    fake.signInResult = { session: null, error: authError('Invalid login credentials.') };
    const service = createAuthService(fake);

    const result = await service.signIn('a@example.com', 'wrong-password');

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.message).toBe('Invalid login credentials.');
    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });

  it('refreshSession converts a genuine rejection to a safe MappingResult failure', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('network died');
    const service = createAuthService(fake);

    const result = await service.refreshSession();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]).toEqual({
      category: 'authentication',
      code: 'AUTH_UNEXPECTED_ERROR',
      message: expect.any(String),
    });
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ operation: 'refreshSession' }),
    );
  });

  it('signUp converts a genuine rejection to a safe MappingResult failure', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('boom');
    const service = createAuthService(fake);

    const result = await service.signUp('a@example.com', 'password123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AUTH_UNEXPECTED_ERROR');
  });

  it('signOut converts a genuine rejection to a safe MappingResult failure', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('boom');
    const service = createAuthService(fake);

    const result = await service.signOut();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AUTH_UNEXPECTED_ERROR');
  });

  it('requestPasswordReset converts a genuine rejection to a safe MappingResult failure', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('boom');
    const service = createAuthService(fake);

    const result = await service.requestPasswordReset('a@example.com');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AUTH_UNEXPECTED_ERROR');
  });

  it('completePasswordReset converts a genuine rejection to a safe MappingResult failure', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('boom');
    const service = createAuthService(fake);

    const result = await service.completePasswordReset('newpassword123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AUTH_UNEXPECTED_ERROR');
  });

  it('getSession converts a genuine rejection to a safe MappingResult failure', async () => {
    const fake = new FakeAuthClient();
    fake.rejectWith = new Error('boom');
    const service = createAuthService(fake);

    const result = await service.getSession();
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('AUTH_UNEXPECTED_ERROR');
  });

  it('still returns SUPABASE_NOT_CONFIGURED, not AUTH_UNEXPECTED_ERROR, when there is no client at all', async () => {
    const service = createAuthService(null);
    const result = await service.signIn('a@example.com', 'password123');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0]?.code).toBe('SUPABASE_NOT_CONFIGURED');
    expect(captureError).not.toHaveBeenCalled();
    expect(logDiagnosticEvent).not.toHaveBeenCalled();
  });
});

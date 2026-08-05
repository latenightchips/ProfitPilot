import { describe, expect, it } from 'vitest';

import type {
  AuthClient,
  SupabaseAuthErrorLike,
  SupabaseAuthSession,
} from '@/services/auth/authService';
import { createAuthService } from '@/services/auth/authService';
import type { AuthChangeEvent, AuthSession } from '@/services/auth/types';

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

  async signUp() {
    return {
      data: { user: this.signUpResult.session?.user ?? null, session: this.signUpResult.session },
      error: this.signUpResult.error,
    };
  }

  async signInWithPassword() {
    return {
      data: { user: this.signInResult.session?.user ?? null, session: this.signInResult.session },
      error: this.signInResult.error,
    };
  }

  async signOut() {
    return { error: this.signOutError };
  }

  async resetPasswordForEmail() {
    return { error: this.resetError };
  }

  async getSession() {
    return { data: { session: this.getSessionResult.session }, error: this.getSessionResult.error };
  }

  async refreshSession() {
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

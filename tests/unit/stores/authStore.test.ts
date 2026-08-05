import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

/**
 * Authentication Store — 06_TASKS.md M8-016. `services/auth` is mocked
 * wholesale here — `authStore.ts` must never reach `@supabase/supabase-js`
 * itself, so there is nothing lower to fake against; this proves the
 * Store's own state transitions given whatever `authService` reports,
 * the same boundary `authService.test.ts`'s own fake `AuthClient` draws
 * one layer down.
 */
vi.mock('@/services/auth', () => ({
  authService: {
    checkAvailability: vi.fn(),
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    requestPasswordReset: vi.fn(),
    completePasswordReset: vi.fn(),
  },
}));

const mockAuthService = vi.mocked(authService);

const AUTH_SESSION = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: 1234567890,
  user: { id: 'user-1', email: 'user@example.com' },
};

const AUTH_ERROR = {
  category: 'authentication' as const,
  code: 'SIMULATED',
  message: 'Simulated.',
};

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
});

describe('initialize', () => {
  it('resolves to unauthenticated with no error when Supabase is not configured', async () => {
    mockAuthService.checkAvailability.mockReturnValue({
      available: false,
      reason: 'not configured',
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.status).toBe('unauthenticated');
    expect(state.errors).toEqual([]);
    expect(mockAuthService.getSession).not.toHaveBeenCalled();
  });

  it('restores an existing session when Supabase is configured and a session exists', async () => {
    mockAuthService.checkAvailability.mockReturnValue({ available: true });
    mockAuthService.getSession.mockResolvedValue({ ok: true, data: AUTH_SESSION });
    mockAuthService.onAuthStateChange.mockReturnValue(() => {});

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.status).toBe('authenticated');
    expect(state.user).toEqual(AUTH_SESSION.user);
    expect(state.cloudSyncEligible).toBe(true);
  });

  it('resolves to unauthenticated when configured but no session exists', async () => {
    mockAuthService.checkAvailability.mockReturnValue({ available: true });
    mockAuthService.getSession.mockResolvedValue({ ok: true, data: null });
    mockAuthService.onAuthStateChange.mockReturnValue(() => {});

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('surfaces a getSession failure as an error state', async () => {
    mockAuthService.checkAvailability.mockReturnValue({ available: true });
    mockAuthService.getSession.mockResolvedValue({ ok: false, errors: [AUTH_ERROR] });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.status).toBe('error');
    expect(state.errors).toEqual([AUTH_ERROR]);
  });
});

describe('signUp', () => {
  it('sets authenticated state on success', async () => {
    mockAuthService.signUp.mockResolvedValue({ ok: true, data: AUTH_SESSION });

    const ok = await useAuthStore.getState().signUp('a@example.com', 'password123');

    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
    expect(useAuthStore.getState().user).toEqual(AUTH_SESSION.user);
  });

  it('leaves user unauthenticated when email confirmation is required (null session)', async () => {
    mockAuthService.signUp.mockResolvedValue({ ok: true, data: null });

    const ok = await useAuthStore.getState().signUp('a@example.com', 'password123');

    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('sets error state on failure', async () => {
    mockAuthService.signUp.mockResolvedValue({ ok: false, errors: [AUTH_ERROR] });

    const ok = await useAuthStore.getState().signUp('a@example.com', 'password123');

    expect(ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().errors).toEqual([AUTH_ERROR]);
  });
});

describe('signIn', () => {
  it('sets authenticated state on success', async () => {
    mockAuthService.signIn.mockResolvedValue({ ok: true, data: AUTH_SESSION });
    const ok = await useAuthStore.getState().signIn('a@example.com', 'password123');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('sets error state on failure', async () => {
    mockAuthService.signIn.mockResolvedValue({ ok: false, errors: [AUTH_ERROR] });
    const ok = await useAuthStore.getState().signIn('a@example.com', 'wrong');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('error');
  });
});

describe('signOut', () => {
  it('clears user and sets unauthenticated on success', async () => {
    useAuthStore.setState({
      user: AUTH_SESSION.user,
      status: 'authenticated',
      cloudSyncEligible: true,
      errors: [],
    });
    mockAuthService.signOut.mockResolvedValue({ ok: true, data: undefined });

    const ok = await useAuthStore.getState().signOut();

    expect(ok).toBe(true);
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.status).toBe('unauthenticated');
    expect(state.cloudSyncEligible).toBe(false);
  });

  it('sets error state on failure without clearing user', async () => {
    useAuthStore.setState({
      user: AUTH_SESSION.user,
      status: 'authenticated',
      cloudSyncEligible: true,
      errors: [],
    });
    mockAuthService.signOut.mockResolvedValue({ ok: false, errors: [AUTH_ERROR] });

    const ok = await useAuthStore.getState().signOut();

    expect(ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('error');
    expect(useAuthStore.getState().user).toEqual(AUTH_SESSION.user);
  });
});

describe('requestPasswordReset', () => {
  it('does not change status on success or failure', async () => {
    useAuthStore.setState({ status: 'authenticated' });
    mockAuthService.requestPasswordReset.mockResolvedValue({ ok: true, data: undefined });
    const ok = await useAuthStore.getState().requestPasswordReset('a@example.com');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('sets errors on failure without changing status', async () => {
    useAuthStore.setState({ status: 'unauthenticated' });
    mockAuthService.requestPasswordReset.mockResolvedValue({ ok: false, errors: [AUTH_ERROR] });
    const ok = await useAuthStore.getState().requestPasswordReset('a@example.com');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(useAuthStore.getState().errors).toEqual([AUTH_ERROR]);
  });
});

describe('completePasswordReset', () => {
  it('sets authenticated state on success', async () => {
    mockAuthService.completePasswordReset.mockResolvedValue({ ok: true, data: undefined });
    const ok = await useAuthStore.getState().completePasswordReset('newpassword123');
    expect(ok).toBe(true);
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  it('sets error state on failure', async () => {
    mockAuthService.completePasswordReset.mockResolvedValue({ ok: false, errors: [AUTH_ERROR] });
    const ok = await useAuthStore.getState().completePasswordReset('newpassword123');
    expect(ok).toBe(false);
    expect(useAuthStore.getState().status).toBe('error');
  });
});

describe('clearErrors', () => {
  it('clears the errors array', () => {
    useAuthStore.setState({ errors: [AUTH_ERROR] });
    useAuthStore.getState().clearErrors();
    expect(useAuthStore.getState().errors).toEqual([]);
  });
});

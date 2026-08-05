import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SignUpPage from '@/app/sign-up/page';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

/**
 * Sign-Up Flow — 06_TASKS.md M8-017. `services/auth`'s `authService` is
 * mocked — this page (via `authStore`) never reaches
 * `@supabase/supabase-js` directly, and no live Supabase project exists
 * in this sandbox to test against for real (see
 * `services/auth/supabaseClient.ts`'s own header comment).
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

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
});

describe('SignUpPage', () => {
  it('explains that an account is optional and describes cloud sync', () => {
    render(<SignUpPage />);
    expect(screen.getByText(/entirely optional/i)).toBeInTheDocument();
    expect(screen.getByText(/sync your data across devices/i)).toBeInTheDocument();
  });

  it('shows a validation error and does not call signUp when passwords do not match', async () => {
    render(<SignUpPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'different123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(mockAuthService.signUp).not.toHaveBeenCalled();
  });

  it('shows an immediate-session success screen when sign-up returns a session', async () => {
    mockAuthService.signUp.mockResolvedValue({
      ok: true,
      data: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: null,
        user: { id: 'u1', email: 'a@example.com' },
      },
    });

    render(<SignUpPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(screen.getByText(/a@example.com/)).toBeInTheDocument();
  });

  it('shows a "check your email" screen when sign-up requires confirmation (null session)', async () => {
    mockAuthService.signUp.mockResolvedValue({ ok: true, data: null });

    render(<SignUpPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('shows a real error, including the "not configured" case in this sandbox', async () => {
    mockAuthService.signUp.mockResolvedValue({
      ok: false,
      errors: [
        {
          category: 'authentication',
          code: 'SUPABASE_NOT_CONFIGURED',
          message: 'Cloud accounts are not available in this environment.',
        },
      ],
    });

    render(<SignUpPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not available in this environment/i,
    );
  });
});

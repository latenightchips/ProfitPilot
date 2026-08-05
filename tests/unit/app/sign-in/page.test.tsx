import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SignInPage from '@/app/sign-in/page';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

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

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
});

/**
 * Sign-In Flow — 06_TASKS.md M8-018. Same "mock `services/auth`, never a
 * live Supabase project" scope as `sign-up/page.test.tsx`.
 */
describe('SignInPage', () => {
  it('shows the local-data notice, a Forgot-password link, and a Sign-up link', () => {
    render(<SignInPage />);
    expect(screen.getByText(/local data on this device is never changed/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toHaveAttribute(
      'href',
      '/reset-password',
    );
    expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/sign-up');
  });

  it('navigates to the Dashboard on successful sign-in', async () => {
    mockAuthService.signIn.mockResolvedValue({
      ok: true,
      data: {
        accessToken: 'a',
        refreshToken: 'r',
        expiresAt: null,
        user: { id: 'u1', email: 'a@example.com' },
      },
    });

    render(<SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(push).toHaveBeenCalledWith('/');
  });

  it('shows an error and does not navigate on failed sign-in', async () => {
    mockAuthService.signIn.mockResolvedValue({
      ok: false,
      errors: [
        {
          category: 'authentication',
          code: 'invalid_credentials',
          message: 'Invalid login credentials.',
        },
      ],
    });

    render(<SignInPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/invalid login credentials/i);
    expect(push).not.toHaveBeenCalled();
  });
});

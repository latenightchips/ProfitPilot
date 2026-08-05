import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordPage from '@/app/reset-password/page';
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

const mockAuthService = vi.mocked(authService);

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthService.onAuthStateChange.mockReturnValue(() => {});
  useAuthStore.setState({ user: null, status: 'idle', errors: [], cloudSyncEligible: false });
});

/**
 * Password Reset Flow — 06_TASKS.md M8-019. Same "mock `services/auth`,
 * never a live Supabase project or a real delivered email" scope as the
 * sibling sign-up/sign-in page tests — see `app/reset-password/page.tsx`'s
 * own header comment for why the "recovery active" state can only be
 * simulated here, never observed end-to-end.
 */
describe('ResetPasswordPage — request state (default)', () => {
  it('renders the request form', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows a success message after a successful request, without confirming account existence', async () => {
    mockAuthService.requestPasswordReset.mockResolvedValue({ ok: true, data: undefined });

    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByText('Check your email')).toBeInTheDocument();
    expect(screen.getByText(/if an account exists for a@example.com/i)).toBeInTheDocument();
  });

  it('shows an error on a failed request', async () => {
    mockAuthService.requestPasswordReset.mockResolvedValue({
      ok: false,
      errors: [{ category: 'authentication', code: 'RATE_LIMITED', message: 'Too many requests.' }],
    });

    render(<ResetPasswordPage />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i);
  });
});

function fireRecoveryEvent(): void {
  const callback = mockAuthService.onAuthStateChange.mock.calls[0]?.[0];
  if (callback === undefined) throw new Error('onAuthStateChange was never subscribed to');
  callback(null, 'PASSWORD_RECOVERY');
}

describe('ResetPasswordPage — recovery-active state (simulated PASSWORD_RECOVERY event)', () => {
  it('shows the new-password form once a PASSWORD_RECOVERY event fires', async () => {
    render(<ResetPasswordPage />);
    expect(mockAuthService.onAuthStateChange).toHaveBeenCalled();
    fireRecoveryEvent();

    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
  });

  it('shows a mismatch error and does not call completePasswordReset when passwords differ', async () => {
    render(<ResetPasswordPage />);
    fireRecoveryEvent();
    await screen.findByRole('heading', { name: 'Choose a new password' });

    await userEvent.type(screen.getByLabelText('New password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'different456');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(screen.getByRole('alert')).toHaveTextContent(/do not match/i);
    expect(mockAuthService.completePasswordReset).not.toHaveBeenCalled();
  });

  it('shows a success screen once the password is updated', async () => {
    mockAuthService.completePasswordReset.mockResolvedValue({ ok: true, data: undefined });

    render(<ResetPasswordPage />);
    fireRecoveryEvent();
    await screen.findByRole('heading', { name: 'Choose a new password' });

    await userEvent.type(screen.getByLabelText('New password'), 'password123');
    await userEvent.type(screen.getByLabelText('Confirm new password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Update password' }));

    expect(await screen.findByText('Password updated')).toBeInTheDocument();
  });
});

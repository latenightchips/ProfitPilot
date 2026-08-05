'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { authService } from '@/services/auth';
import { useAuthStore } from '@/stores/authStore';

/**
 * Password Reset Flow — 06_TASKS.md M8-019 ("Create Password Reset
 * Flow"). Description: "Implement password reset request and completion
 * states." DoD: "Users receive clear success, expiration, and failure
 * messages."
 *
 * **Two states on one page, distinguished by `'PASSWORD_RECOVERY'`, not
 * a URL parameter this app controls.** Clicking the emailed reset link
 * redirects here with Supabase's own recovery tokens in the URL (handled
 * entirely by `@supabase/supabase-js`'s `detectSessionInUrl`, never
 * parsed by this file); the client library establishes a temporary
 * session and fires a `'PASSWORD_RECOVERY'` auth event, which this page
 * listens for directly via `authService.onAuthStateChange` (a page
 * calling `services/auth` directly, not through `authStore`, is the same
 * established pattern `app/settings/page.tsx` already uses for
 * `services/export`/`services/import` — the "must not call
 * `@supabase/supabase-js` directly" boundary is about the SDK, not about
 * `authStore` specifically). Arriving here any other way shows the
 * request form.
 *
 * **"Expiration" messages**: a real, expired-or-invalid recovery link
 * lands here with no valid session, so this page never receives a
 * `'PASSWORD_RECOVERY'` event and simply shows the request form again —
 * indistinguishable, by design, from never having clicked a link, since
 * Supabase's own client does not surface a separate "your link expired"
 * signal to the browser. `completePasswordReset` failures (a real,
 * distinct error from `authStore.errors`) cover the "failure" message;
 * a successful `requestPasswordReset` covers "success."
 *
 * **Cannot be end-to-end verified against a real reset email in this
 * environment** — no Supabase project is configured here (see
 * `services/auth/supabaseClient.ts`'s own header comment for what was
 * checked). Both states are exercised in this batch's own tests against
 * a fake `AuthClient`; see this batch's final summary for the exact
 * scope of what "tested" means here.
 */
export default function ResetPasswordPage() {
  const status = useAuthStore((state) => state.status);
  const errors = useAuthStore((state) => state.errors);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const completePasswordReset = useAuthStore((state) => state.completePasswordReset);

  const [recoveryActive, setRecoveryActive] = useState(false);
  const [email, setEmail] = useState('');
  const [requestSent, setRequestSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.onAuthStateChange((_session, event) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryActive(true);
    });
    return () => unsubscribe?.();
  }, []);

  async function handleRequest(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const ok = await requestPasswordReset(email);
    if (ok) setRequestSent(true);
  }

  async function handleComplete(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setConfirmMismatch(true);
      return;
    }
    setConfirmMismatch(false);
    const ok = await completePasswordReset(newPassword);
    if (ok) setCompleted(true);
  }

  if (completed) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">Password updated</h1>
        <p className="text-sm text-muted-foreground">
          Your password has been changed. You can now use it to sign in.
        </p>
        <Link href="/" className="text-sm text-primary hover:underline">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (recoveryActive) {
    return (
      <div className="mx-auto max-w-md space-y-6 p-6">
        <h1 className="text-xl font-semibold text-foreground">Choose a new password</h1>
        <form onSubmit={(event) => void handleComplete(event)} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span>New password</span>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span>Confirm new password</span>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2"
            />
          </label>
          {confirmMismatch && (
            <p className="text-xs text-destructive" role="alert">
              Passwords do not match.
            </p>
          )}
          {errors.length > 0 && (
            <p className="text-xs text-destructive" role="alert">
              {errors[0]?.message}
            </p>
          )}
          <button
            type="submit"
            disabled={status === 'loading'}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {status === 'loading' ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </div>
    );
  }

  if (requestSent) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          If an account exists for {email}, we sent a link to reset your password. The link expires
          after a short time — request a new one below if it no longer works.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter the email address for your account and we&apos;ll send you a link to reset your
          password.
        </p>
      </div>

      <form onSubmit={(event) => void handleRequest(event)} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>

        {errors.length > 0 && (
          <p className="text-xs text-destructive" role="alert">
            {errors[0]?.message}
          </p>
        )}

        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status === 'loading' ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <Link href="/sign-in" className="text-sm text-primary hover:underline">
        Back to sign in
      </Link>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useState } from 'react';

import { useAuthStore } from '@/stores/authStore';

/**
 * Sign-Up Flow — 06_TASKS.md M8-017 ("Create Sign-Up Flow"). Collect:
 * "Email, Password, Password confirmation, Consent acknowledgements
 * where required." Requirements: "Explain that an account is optional.
 * Explain the purpose of cloud synchronization." DoD: "Users can create
 * an account without losing existing local data."
 *
 * **No dedicated consent checkbox** — "Consent acknowledgements where
 * required" is conditional, and no terms-of-service or privacy-policy
 * document exists anywhere in this specification to collect agreement
 * to; inventing placeholder legal text to attach a checkbox to would be
 * fabricating a real-world document this project was never given. The
 * "Explain" requirements this task's own DoD actually depends on are
 * satisfied below as plain, static copy instead.
 *
 * **No page in 03_UI.md specifies this flow's layout** (03_UI.md's own
 * "SETTINGS" page section doesn't name an Account area at all — the same
 * gap `app/settings/page.tsx`'s own header comment already documents for
 * Backup/Recovery). This is the same minimal, functional resolution
 * already established for that page: implement exactly what this task's
 * own DoD requires, nothing more.
 *
 * **"Users can create an account without losing existing local data" is
 * satisfied structurally** — sign-up only ever calls `authService.signUp`
 * (`services/auth`), which never reads or writes anything under
 * `services/persistence`. There is no code path here that could touch
 * local data even accidentally.
 */
export function SignUpPageClient() {
  const status = useAuthStore((state) => state.status);
  const errors = useAuthStore((state) => state.errors);
  const user = useAuthStore((state) => state.user);
  const signUp = useAuthStore((state) => state.signUp);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmMismatch, setConfirmMismatch] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (password !== confirmPassword) {
      setConfirmMismatch(true);
      return;
    }
    setConfirmMismatch(false);
    const ok = await signUp(email, password);
    if (ok) setSubmitted(true);
  }

  if (submitted && user !== null) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">Account created</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;re signed in as {user.email}. Your existing local data is untouched.
        </p>
        <Link href="/" className="text-sm text-primary underline">
          Go to Dashboard
        </Link>
      </div>
    );
  }

  if (submitted && user === null) {
    return (
      <div className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold text-foreground">Check your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a confirmation link to {email}. Confirm your address to finish creating your
          account.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Create an account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An account is entirely optional. ProfitPilot works fully without one — your data stays on
          this device whether or not you create an account. ProfitPilot has no cloud sync; exporting
          your data works either way.
        </p>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-4">
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
        <label className="flex flex-col gap-1 text-sm">
          <span>Password</span>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-border bg-transparent px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span>Confirm password</span>
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
          {status === 'loading' ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/sign-in" className="text-primary underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

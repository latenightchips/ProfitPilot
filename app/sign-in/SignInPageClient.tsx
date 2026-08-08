'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useAuthStore } from '@/stores/authStore';

/**
 * Sign-In Flow — 06_TASKS.md M8-018 ("Create Sign-In Flow"). Include:
 * "Email, Password, Forgot-password action, Error handling, Local-data
 * notice." DoD: "Successful sign-in preserves local data until
 * synchronization choices are resolved."
 *
 * **"Successful sign-in preserves local data" is satisfied
 * structurally, and "until synchronization choices are resolved" has
 * nothing to resolve yet** — `signIn` only ever calls `authService.signIn`,
 * which never reads or writes `services/persistence`; no Cloud Sync
 * feature exists yet (a later, dependent Milestone 8 batch) to present
 * any synchronization choice at all. The "local-data notice" below
 * states this honestly rather than describing a choice screen nothing
 * in this version can show.
 */
export function SignInPageClient() {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const errors = useAuthStore((state) => state.errors);
  const signIn = useAuthStore((state) => state.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    const ok = await signIn(email, password);
    if (ok) router.push('/');
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Signing in is optional and only needed for cloud sync in a future update. Your local data
          on this device is never changed by signing in.
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
            value={password}
            onChange={(event) => setPassword(event.target.value)}
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
          {status === 'loading' ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="flex flex-col gap-1 text-sm">
        <Link href="/reset-password" className="text-primary underline">
          Forgot your password?
        </Link>
        <p className="text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-primary underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

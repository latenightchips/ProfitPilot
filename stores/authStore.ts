/**
 * Authentication Store — 06_TASKS.md M8-016 ("Implement Authentication
 * Store"). Store: "Current user, Session status, Loading status,
 * Authentication error, Cloud-sync eligibility." DoD: "Authentication
 * state remains separate from portfolio data."
 *
 * **Kept entirely independent from `portfolioStore`/every feature
 * Store** — this batch's own standing architecture requirement. No
 * import here reaches into `stores/portfolioStore.ts` or any other
 * feature Store, and nothing in those Stores imports this one either
 * (Cloud Sync, a later dependent batch, is the first place a portfolio
 * Store would ever need to know a user is signed in — out of scope here).
 * `initialize`/`signIn`/`signUp`/`signOut` all call only `services/auth`,
 * never `@supabase/supabase-js` directly (M8-015's own DoD, enforced the
 * same way at this layer too).
 *
 * **`cloudSyncEligible` is exactly `user !== null`** — M8-016 names it as
 * a field to store, but no Cloud Sync feature exists yet to define a
 * richer eligibility rule (e.g. email verification, plan tier). Being
 * signed in is the only real precondition this codebase can express
 * today; extend this once Cloud Sync (a later, dependent Milestone 8
 * batch) actually defines what else eligibility requires.
 *
 * **`initialize()` is idempotent and safe to call with no Supabase
 * configuration** — it reads `authService.checkAvailability()` first and
 * resolves straight to `'unauthenticated'` with no error when cloud
 * accounts aren't available, rather than surfacing "not configured" as
 * a user-facing authentication failure. Anonymous/manual mode staying
 * fully functional with zero auth configuration (this batch's own
 * standing requirement) depends on this path never blocking anything.
 */
import { create } from 'zustand';

import { authService, type AuthSession, type AuthUser } from '@/services/auth';
import type { ApplicationError } from '@/services/shared';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated' | 'error';

export interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  errors: ApplicationError[];
  cloudSyncEligible: boolean;
}

export interface AuthActions {
  initialize: () => Promise<void>;
  signUp: (email: string, password: string) => Promise<boolean>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: (options?: { scope?: 'global' | 'local' | 'others' }) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  completePasswordReset: (newPassword: string) => Promise<boolean>;
  clearErrors: () => void;
}

let unsubscribeAuthChanges: (() => void) | null = null;

function applySession(session: AuthSession | null): Partial<AuthState> {
  return {
    user: session?.user ?? null,
    status: session === null ? 'unauthenticated' : 'authenticated',
    cloudSyncEligible: session !== null,
  };
}

export const useAuthStore = create<AuthState & AuthActions>((set) => ({
  user: null,
  status: 'idle',
  errors: [],
  cloudSyncEligible: false,

  initialize: async () => {
    set({ status: 'loading', errors: [] });

    if (!authService.checkAvailability().available) {
      set({ user: null, status: 'unauthenticated', cloudSyncEligible: false });
      return;
    }

    const result = await authService.getSession();
    if (!result.ok) {
      set({ status: 'error', errors: result.errors });
      return;
    }
    set(applySession(result.data));

    if (unsubscribeAuthChanges === null) {
      unsubscribeAuthChanges = authService.onAuthStateChange((session) => {
        set(applySession(session));
      });
    }
  },

  signUp: async (email, password) => {
    set({ status: 'loading', errors: [] });
    const result = await authService.signUp(email, password);
    if (!result.ok) {
      set({ status: 'error', errors: result.errors });
      return false;
    }
    set(applySession(result.data));
    return true;
  },

  signIn: async (email, password) => {
    set({ status: 'loading', errors: [] });
    const result = await authService.signIn(email, password);
    if (!result.ok) {
      set({ status: 'error', errors: result.errors });
      return false;
    }
    set(applySession(result.data));
    return true;
  },

  signOut: async (options) => {
    set({ status: 'loading', errors: [] });
    const result = await authService.signOut(options);
    if (!result.ok) {
      set({ status: 'error', errors: result.errors });
      return false;
    }
    set({ user: null, status: 'unauthenticated', cloudSyncEligible: false });
    return true;
  },

  requestPasswordReset: async (email) => {
    // Deliberately does not touch `status` — a password-reset request
    // says nothing about whether the caller currently has a session
    // (this flow is reachable both signed-out, from `/sign-in`, and
    // signed-in, from `/settings`). Success/failure of the request
    // itself is only ever this return value plus `errors`; the calling
    // page tracks its own "email sent" UI state.
    set({ errors: [] });
    const result = await authService.requestPasswordReset(email);
    if (!result.ok) {
      set({ errors: result.errors });
      return false;
    }
    return true;
  },

  completePasswordReset: async (newPassword) => {
    set({ status: 'loading', errors: [] });
    const result = await authService.completePasswordReset(newPassword);
    if (!result.ok) {
      set({ status: 'error', errors: result.errors });
      return false;
    }
    set({ status: 'authenticated' });
    return true;
  },

  clearErrors: () => set({ errors: [] }),
}));

'use client';

/**
 * Auth Provider — Milestone 8 Batch 5 (M8-014–M8-021). Mirrors
 * `PersistenceProvider.tsx`'s own role: a single, well-known place for
 * "the app has just started, restore auth state" to live, wrapped around
 * `AppShell` in `app/layout.tsx` so it runs regardless of which route
 * the user lands on first.
 *
 * **A separate provider, not folded into `PersistenceProvider`** — this
 * batch's own standing requirement keeps `authStore` independent from
 * portfolio/feature Stores; mixing its initialization into the provider
 * that hydrates those six Stores would blur that boundary at the wiring
 * layer even though the Store code itself stays clean. `useAuthStore
 * .getState().initialize()` is safe to call unconditionally — it reads
 * `authService.checkAvailability()` first and resolves to
 * `'unauthenticated'` with no error when Supabase isn't configured
 * (`stores/authStore.ts`'s own header comment), so this never blocks or
 * breaks anonymous/manual mode.
 */
import { useEffect } from 'react';

import { useAuthStore } from '@/stores/authStore';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useAuthStore.getState().initialize();
  }, []);

  return children;
}

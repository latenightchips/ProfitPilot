/**
 * Authentication Service — 06_TASKS.md M8-014–M8-015 ("Authentication").
 * `authStore.ts` and every UI flow import from here, never from
 * `./supabaseClient.ts` or `@supabase/supabase-js` directly.
 */
export * from './authService';
export * from './supabaseClient';
export * from './types';

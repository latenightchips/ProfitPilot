/**
 * Persistence adapters — public entry point.
 *
 * `supabase.adapter.ts` (M8-025) is a later, dependent Milestone 8 batch
 * requiring a real Supabase project — see `./memory.adapter.ts`'s own
 * header comment for why only the memory and local storage adapters
 * exist so far.
 */
export { createLocalStorageAdapter } from './local-storage.adapter';
export {
  buildLocalStorageKey,
  buildLocalStorageRecordTypePrefix,
  isProfitPilotLocalStorageKey,
  LOCAL_STORAGE_KEY_VERSION,
  LOCAL_STORAGE_NAMESPACE,
  recordIdFromLocalStorageKey,
} from './localStorageKeys';
export { createMemoryAdapter } from './memory.adapter';

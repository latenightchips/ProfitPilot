/**
 * Persistence adapters — public entry point.
 *
 * `local-storage.adapter.ts` (M8-006) and `supabase.adapter.ts` (M8-025)
 * are later, dependent Milestone 8 batches — see `./memory.adapter.ts`'s
 * own header comment for why only the memory adapter exists so far.
 */
export { createMemoryAdapter } from './memory.adapter';

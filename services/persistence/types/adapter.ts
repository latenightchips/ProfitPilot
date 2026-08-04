/**
 * Persistence Adapter contract — 06_TASKS.md M8-001 ("Create Persistence
 * Architecture"). DoD: "Application features access persistence through
 * typed adapters rather than browser or Supabase APIs directly."
 *
 * **Async throughout, including reads/writes a synchronous backend
 * (browser `localStorage`, M8-006) could technically serve
 * synchronously.** The same interface must also serve the Supabase
 * adapter (M8-025, a real network call) without a second, parallel
 * interface — `PersistenceService` (`../persistence.service.ts`) and
 * every Store that calls it must not need to know which adapter is
 * behind the call. `MemoryAdapter` (`../adapters/memory.adapter.ts`,
 * this same batch) and the future `LocalStorageAdapter` simply resolve
 * immediately; the cost of wrapping a synchronous call in an already-
 * resolved Promise is negligible next to the alternative of two
 * incompatible adapter shapes.
 *
 * **Returns `MappingResult<T>` (`@/services/shared`), not
 * `ServiceResult<T>`.** No adapter method calls the Formula Engine, so
 * there is no real `engineVersion`/`formulaVersion` to report —
 * `MappingResult` exists in this codebase for exactly this case (see its
 * own header comment: "pure data-transformation Services that make no
 * Engine calculation"), and reusing it here is the same choice
 * `services/portfolio/mapping.ts` and `services/market/quote.ts` already
 * made for the same reason.
 */
import type { MappingResult } from '@/services/shared';

import type { PersistedRecordType, StorageEnvelope } from './envelope';

export interface PersistenceAdapterAvailability {
  available: boolean;
  /** Present only when `available` is false — a safe, user-facing reason. */
  reason?: string;
}

/**
 * `read`/`list` resolve `MappingResult<... | null>` rather than failing
 * when a record is missing — "not found" is an expected, ordinary
 * outcome (a first-time user, a never-saved record type), not an error
 * condition. Genuine failures (malformed stored data, storage
 * unavailable, network failure) are the only cases that produce
 * `ok: false`.
 */
export interface PersistenceAdapter {
  readonly name: string;

  checkAvailability(): PersistenceAdapterAvailability;

  read<T>(
    recordType: PersistedRecordType,
    id: string,
  ): Promise<MappingResult<StorageEnvelope<T> | null>>;

  write<T>(
    recordType: PersistedRecordType,
    id: string,
    envelope: StorageEnvelope<T>,
  ): Promise<MappingResult<void>>;

  delete(recordType: PersistedRecordType, id: string): Promise<MappingResult<void>>;

  list<T>(recordType: PersistedRecordType): Promise<MappingResult<StorageEnvelope<T>[]>>;

  bulkWrite<T>(
    recordType: PersistedRecordType,
    envelopes: StorageEnvelope<T>[],
  ): Promise<MappingResult<void>>;

  /** Clears every record this adapter manages — 06_TASKS.md M8-006's "Clear application data." */
  clear(): Promise<MappingResult<void>>;
}

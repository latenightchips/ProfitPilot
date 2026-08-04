/**
 * Persistence Service — 06_TASKS.md M8-001's own suggested structure
 * (`persistence.service.ts`). This is the *only* thing Stores and
 * features may call to read or write persisted data — never a
 * `PersistenceAdapter` directly, and never `localStorage`/
 * `supabase-js`/IndexedDB directly. That boundary is what M8-001's own
 * DoD ("Application features access persistence through typed adapters
 * rather than browser or Supabase APIs directly") and this batch's
 * additional architectural requirement ("Stores must communicate only
 * through PersistenceService interfaces") both ask for.
 *
 * A plain factory function returning an object of methods
 * (`createPersistenceService`), matching `./adapters/memory.adapter.ts`'s
 * own `createMemoryAdapter` shape — this codebase's existing Services are
 * all plain functions, not classes; the one difference here is that a
 * Persistence Service genuinely needs to hold onto *which adapter* it was
 * built with, which a stateless function cannot express, so a small
 * factory closure is the minimal deviation from that convention, not a
 * new pattern invented for its own sake. `persistenceService` below is
 * the one shared instance the rest of the application should import;
 * `createPersistenceService` itself stays exported so tests can build
 * isolated instances with their own adapter, avoiding cross-test state
 * leakage through a shared singleton.
 *
 * Every read validates the stored envelope (`./validate.ts`, M8-005)
 * before returning its payload — including reads from the adapter this
 * same service just wrote, since `localStorage` (M8-006) can be edited
 * outside the application between a write and a later read. Every write
 * validates the envelope it is about to persist, catching a caller that
 * passes a payload not matching its own record type's schema before
 * corrupt data ever reaches storage.
 *
 * **`listEnvelopes` (Milestone 8 Batch 3, M8-036/M8-037)** — every other
 * read method here deliberately unwraps down to the plain payload, since
 * that is all a Store ever needs. The Export Service needs the opposite:
 * M8-037's own "Include" list names "Storage envelope... Versions,
 * Timestamps" as things a full backup must preserve — the real
 * `createdAt`/`updatedAt`/`checksum` of each record, not values re-stamped
 * at export time. Adding this method (rather than having
 * `services/export/` reach for a `PersistenceAdapter` itself) is what
 * keeps "Do not bypass PersistenceService" true for Export/Import the same
 * way it already is for every Store.
 */
import type { MappingResult } from '@/services/shared';

import { createLocalStorageAdapter } from './adapters';
import { createEnvelope, updateEnvelope } from './envelope';
import type {
  PersistedRecordType,
  PersistenceAdapter,
  PersistenceAdapterAvailability,
  StorageEnvelope,
} from './types';
import { validatePersistedRecord } from './validate';

export interface PersistenceService {
  checkAvailability(): PersistenceAdapterAvailability;
  read<T>(recordType: PersistedRecordType, id: string): Promise<MappingResult<T | null>>;
  write<T>(
    recordType: PersistedRecordType,
    id: string,
    payload: T,
  ): Promise<MappingResult<StorageEnvelope<T>>>;
  delete(recordType: PersistedRecordType, id: string): Promise<MappingResult<void>>;
  list<T>(recordType: PersistedRecordType): Promise<MappingResult<T[]>>;
  listEnvelopes<T>(recordType: PersistedRecordType): Promise<MappingResult<StorageEnvelope<T>[]>>;
  bulkWrite<T>(
    recordType: PersistedRecordType,
    envelopes: StorageEnvelope<T>[],
  ): Promise<MappingResult<void>>;
  clear(): Promise<MappingResult<void>>;
}

export function createPersistenceService(
  adapter: PersistenceAdapter = createLocalStorageAdapter(),
): PersistenceService {
  return {
    checkAvailability(): PersistenceAdapterAvailability {
      return adapter.checkAvailability();
    },

    async read<T>(recordType: PersistedRecordType, id: string): Promise<MappingResult<T | null>> {
      const stored = await adapter.read<unknown>(recordType, id);
      if (!stored.ok) return stored;
      if (stored.data === null) return { ok: true, data: null };

      const validated = validatePersistedRecord<T>(recordType, stored.data);
      if (!validated.ok) return validated;
      return { ok: true, data: validated.data.payload };
    },

    async write<T>(
      recordType: PersistedRecordType,
      id: string,
      payload: T,
    ): Promise<MappingResult<StorageEnvelope<T>>> {
      const existing = await adapter.read<T>(recordType, id);
      const envelope =
        existing.ok && existing.data !== null
          ? updateEnvelope(existing.data, payload)
          : createEnvelope(recordType, id, payload);

      const validated = validatePersistedRecord<T>(recordType, envelope);
      if (!validated.ok) return validated;

      const written = await adapter.write(recordType, id, envelope);
      if (!written.ok) return written;
      return { ok: true, data: envelope };
    },

    async delete(recordType: PersistedRecordType, id: string): Promise<MappingResult<void>> {
      return adapter.delete(recordType, id);
    },

    async list<T>(recordType: PersistedRecordType): Promise<MappingResult<T[]>> {
      const stored = await adapter.list<unknown>(recordType);
      if (!stored.ok) return stored;

      const payloads: T[] = [];
      for (const envelope of stored.data) {
        const validated = validatePersistedRecord<T>(recordType, envelope);
        if (!validated.ok) return validated;
        payloads.push(validated.data.payload);
      }
      return { ok: true, data: payloads };
    },

    async listEnvelopes<T>(
      recordType: PersistedRecordType,
    ): Promise<MappingResult<StorageEnvelope<T>[]>> {
      const stored = await adapter.list<unknown>(recordType);
      if (!stored.ok) return stored;

      const envelopes: StorageEnvelope<T>[] = [];
      for (const envelope of stored.data) {
        const validated = validatePersistedRecord<T>(recordType, envelope);
        if (!validated.ok) return validated;
        envelopes.push(validated.data);
      }
      return { ok: true, data: envelopes };
    },

    async bulkWrite<T>(
      recordType: PersistedRecordType,
      envelopes: StorageEnvelope<T>[],
    ): Promise<MappingResult<void>> {
      for (const envelope of envelopes) {
        const validated = validatePersistedRecord<T>(recordType, envelope);
        if (!validated.ok) return validated;
      }
      return adapter.bulkWrite(recordType, envelopes);
    },

    async clear(): Promise<MappingResult<void>> {
      return adapter.clear();
    },
  };
}

/**
 * The shared default instance — backed by `LocalStorageAdapter` (M8-006)
 * as of Milestone 8 Batch 2. No Store or feature imports
 * `createLocalStorageAdapter`/`createMemoryAdapter` or any adapter
 * directly; only this file and tests do.
 */
export const persistenceService = createPersistenceService();

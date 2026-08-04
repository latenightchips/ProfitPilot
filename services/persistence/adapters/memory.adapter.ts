/**
 * In-memory Persistence Adapter — 06_TASKS.md M8-001's own suggested
 * structure (`adapters/memory.adapter.ts`).
 *
 * The only adapter this batch actually implements against real storage:
 * `local-storage.adapter.ts` is M8-006 (Batch 2, browser `localStorage`)
 * and `supabase.adapter.ts` is M8-025 (Batch 6, a real Supabase project
 * this sandbox does not have credentials for) — building either now
 * would mean placeholder or untestable code. This one has no such
 * constraint: it is real, fully working, and exercises the complete
 * `PersistenceAdapter` contract end-to-end today. It is also
 * `PersistenceService`'s (`../persistence.service.ts`) default adapter
 * until M8-006 lands, and the adapter every unit test in this codebase
 * that needs *a* working adapter (without a jsdom `localStorage` or a
 * network mock) should keep using afterward.
 */
import type { MappingResult } from '@/services/shared';

import type {
  PersistedRecordType,
  PersistenceAdapter,
  PersistenceAdapterAvailability,
  StorageEnvelope,
} from '../types';

export function createMemoryAdapter(): PersistenceAdapter {
  const store = new Map<PersistedRecordType, Map<string, StorageEnvelope<unknown>>>();

  function bucket(recordType: PersistedRecordType): Map<string, StorageEnvelope<unknown>> {
    let existing = store.get(recordType);
    if (existing === undefined) {
      existing = new Map();
      store.set(recordType, existing);
    }
    return existing;
  }

  return {
    name: 'memory',

    checkAvailability(): PersistenceAdapterAvailability {
      return { available: true };
    },

    async read<T>(
      recordType: PersistedRecordType,
      id: string,
    ): Promise<MappingResult<StorageEnvelope<T> | null>> {
      const record = bucket(recordType).get(id);
      return { ok: true, data: (record as StorageEnvelope<T> | undefined) ?? null };
    },

    async write<T>(
      recordType: PersistedRecordType,
      id: string,
      envelope: StorageEnvelope<T>,
    ): Promise<MappingResult<void>> {
      bucket(recordType).set(id, envelope as StorageEnvelope<unknown>);
      return { ok: true, data: undefined };
    },

    async delete(recordType: PersistedRecordType, id: string): Promise<MappingResult<void>> {
      bucket(recordType).delete(id);
      return { ok: true, data: undefined };
    },

    async list<T>(recordType: PersistedRecordType): Promise<MappingResult<StorageEnvelope<T>[]>> {
      return { ok: true, data: Array.from(bucket(recordType).values()) as StorageEnvelope<T>[] };
    },

    async bulkWrite<T>(
      recordType: PersistedRecordType,
      envelopes: StorageEnvelope<T>[],
    ): Promise<MappingResult<void>> {
      const target = bucket(recordType);
      for (const envelope of envelopes) {
        target.set(envelope.recordId, envelope as StorageEnvelope<unknown>);
      }
      return { ok: true, data: undefined };
    },

    async clear(): Promise<MappingResult<void>> {
      store.clear();
      return { ok: true, data: undefined };
    },
  };
}

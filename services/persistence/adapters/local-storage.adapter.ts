/**
 * Browser Local Storage Adapter — 06_TASKS.md M8-006 ("Implement Local
 * Storage Adapter"). DoD: "The adapter handles malformed data,
 * unavailable storage, and quota errors safely" — every branch below
 * that can fail is wrapped so a real, safe `MappingResult` failure comes
 * back instead of an uncaught exception (REQ-012 "ERROR HANDLING":
 * "Errors must never expose internal stack traces").
 *
 * The default adapter `PersistenceService` (`../persistence.service.ts`)
 * uses from this batch onward, replacing `MemoryAdapter` — see this
 * file's own `checkAvailability` for how the application still falls
 * back to working (in-memory only, for that session) when
 * `localStorage` itself is unavailable (disabled, private browsing with
 * a zero quota, or no `window` at all during server rendering).
 */
import type { MappingResult } from '@/services/shared';
import { createApplicationError } from '@/services/shared/errors';

import type {
  PersistedRecordType,
  PersistenceAdapter,
  PersistenceAdapterAvailability,
  StorageEnvelope,
} from '../types';
import {
  buildLocalStorageKey,
  buildLocalStorageRecordTypePrefix,
  isProfitPilotLocalStorageKey,
} from './localStorageKeys';

const PROBE_KEY = buildLocalStorageKey('applicationMetadata', '__availability_probe__');

function hasWindowLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function failure(code: string, message: string): MappingResult<never> {
  return { ok: false, errors: [createApplicationError('persistence', code, message)] };
}

/**
 * Distinguishes a genuine quota failure (retryable only after the user
 * frees space or exports data — not by simply retrying) from every other
 * unexpected write failure. `QuotaExceededError` is the standard
 * `DOMException` name browsers use for this; some older engines instead
 * set `error.code === 22`, checked as a fallback.
 */
function isQuotaExceededError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === 'QuotaExceededError' || error.code === 22;
}

export function createLocalStorageAdapter(): PersistenceAdapter {
  return {
    name: 'local-storage',

    checkAvailability(): PersistenceAdapterAvailability {
      if (!hasWindowLocalStorage()) {
        return {
          available: false,
          reason: 'Browser local storage is not available in this environment.',
        };
      }
      try {
        window.localStorage.setItem(PROBE_KEY, '1');
        window.localStorage.removeItem(PROBE_KEY);
        return { available: true };
      } catch {
        return {
          available: false,
          reason:
            'Browser local storage is disabled or full (private browsing can restrict it to zero capacity).',
        };
      }
    },

    async read<T>(
      recordType: PersistedRecordType,
      id: string,
    ): Promise<MappingResult<StorageEnvelope<T> | null>> {
      if (!hasWindowLocalStorage()) {
        return failure('LOCAL_STORAGE_UNAVAILABLE', 'Local storage is not available.');
      }
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(buildLocalStorageKey(recordType, id));
      } catch {
        return failure('LOCAL_STORAGE_READ_FAILED', 'Reading from local storage failed.');
      }
      if (raw === null) return { ok: true, data: null };

      try {
        return { ok: true, data: JSON.parse(raw) as StorageEnvelope<T> };
      } catch {
        return failure(
          'LOCAL_STORAGE_MALFORMED_DATA',
          `Stored "${recordType}" data is not valid JSON and could not be read.`,
        );
      }
    },

    async write<T>(
      recordType: PersistedRecordType,
      id: string,
      envelope: StorageEnvelope<T>,
    ): Promise<MappingResult<void>> {
      if (!hasWindowLocalStorage()) {
        return failure('LOCAL_STORAGE_UNAVAILABLE', 'Local storage is not available.');
      }
      try {
        window.localStorage.setItem(buildLocalStorageKey(recordType, id), JSON.stringify(envelope));
        return { ok: true, data: undefined };
      } catch (error) {
        if (isQuotaExceededError(error)) {
          return failure(
            'LOCAL_STORAGE_QUOTA_EXCEEDED',
            'Local storage is full. Export your data and free up space, then try again.',
          );
        }
        return failure('LOCAL_STORAGE_WRITE_FAILED', 'Writing to local storage failed.');
      }
    },

    async delete(recordType: PersistedRecordType, id: string): Promise<MappingResult<void>> {
      if (!hasWindowLocalStorage()) {
        return failure('LOCAL_STORAGE_UNAVAILABLE', 'Local storage is not available.');
      }
      try {
        window.localStorage.removeItem(buildLocalStorageKey(recordType, id));
        return { ok: true, data: undefined };
      } catch {
        return failure('LOCAL_STORAGE_DELETE_FAILED', 'Deleting from local storage failed.');
      }
    },

    async list<T>(recordType: PersistedRecordType): Promise<MappingResult<StorageEnvelope<T>[]>> {
      if (!hasWindowLocalStorage()) {
        return failure('LOCAL_STORAGE_UNAVAILABLE', 'Local storage is not available.');
      }
      const prefix = buildLocalStorageRecordTypePrefix(recordType);
      const envelopes: StorageEnvelope<T>[] = [];
      try {
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key === null || !key.startsWith(prefix)) continue;
          const raw = window.localStorage.getItem(key);
          if (raw === null) continue;
          envelopes.push(JSON.parse(raw) as StorageEnvelope<T>);
        }
      } catch {
        return failure(
          'LOCAL_STORAGE_MALFORMED_DATA',
          `One or more stored "${recordType}" records are not valid JSON and could not be listed.`,
        );
      }
      return { ok: true, data: envelopes };
    },

    async bulkWrite<T>(
      recordType: PersistedRecordType,
      envelopes: StorageEnvelope<T>[],
    ): Promise<MappingResult<void>> {
      for (const envelope of envelopes) {
        const result = await this.write(recordType, envelope.recordId, envelope);
        if (!result.ok) return result;
      }
      return { ok: true, data: undefined };
    },

    async clear(): Promise<MappingResult<void>> {
      if (!hasWindowLocalStorage()) {
        return failure('LOCAL_STORAGE_UNAVAILABLE', 'Local storage is not available.');
      }
      try {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key !== null && isProfitPilotLocalStorageKey(key)) keysToRemove.push(key);
        }
        for (const key of keysToRemove) window.localStorage.removeItem(key);
        return { ok: true, data: undefined };
      } catch {
        return failure('LOCAL_STORAGE_CLEAR_FAILED', 'Clearing local storage failed.');
      }
    },
  };
}
